import type {
  AssetMeta,
  Candle,
  CandleSeries,
  DataProvenance,
  MarketStatus,
  Quote,
  Timeframe,
} from '@tl/types';
import { TIMEFRAME_SECONDS } from '@tl/types';
import { MarketDataError, type MarketDataProvider } from './provider';
import { getSymbol, listSymbols } from './symbols';
import { marketStatusFor, observedMarketStatus } from './market-hours';

/**
 * Proveedor de todo lo que no es cripto: divisas al contado, índices, materias
 * primas, acciones y fondos cotizados.
 *
 * Existe porque el catálogo tenía un agujero incómodo. Binance cubre cripto y
 * Finnhub cubre acciones estadounidenses, pero **ninguna de las dos da el
 * histórico**: el plan gratuito de Finnhub devuelve la cotización de ahora y
 * nada más, así que un gráfico de Apple era una sola vela y una divisa como el
 * euro no tenía ni eso. La consecuencia práctica es la que se veía en pantalla:
 * el explorador terminaba enseñando casi solo criptomonedas, porque eran las
 * únicas que resolvían.
 *
 * Esta fuente cierra las dos cosas a la vez:
 *
 *   · **Cobertura.** `EURUSD=X` para divisas, `^GSPC` para índices, `GC=F` para
 *     el oro. Son los subyacentes de verdad, no un fondo cotizado que los imita.
 *   · **Historia completa.** Pidiendo `period1`/`period2` en lugar de `range`,
 *     la serie llega con la granularidad solicitada y desde el primer día
 *     negociado: cuarenta años de subidas y bajadas de Apple, no dos minutos.
 *
 * Lo que **no** hace, igual que el resto de fuentes de este paquete: rellenar
 * huecos. Un instrumento sin ticker de Yahoo no cae al motor sintético por la
 * puerta de atrás; falla y lo dice.
 */

const API = 'https://query1.finance.yahoo.com/v8/finance';
const TIMEOUT_MS = 9_000;
/** Cotización en caché. Con quince personas mirando, una sola petición. */
const QUOTE_TTL_MS = 20_000;
/** Una cotización más vieja que esto no se sirve ni como respaldo. */
const MAX_STALE_MS = 20 * 60_000;
/** Yahoo trunca la petición si se piden demasiados símbolos de golpe. */
const SPARK_CHUNK = 20;

/**
 * Profundidad máxima que Yahoo entrega por intervalo intradía.
 *
 * No es un capricho nuestro: pedir un minuto a un año de distancia devuelve una
 * serie vacía. Se recorta el rango pedido a lo que la fuente puede responder,
 * en lugar de dejar el gráfico en blanco sin explicación.
 */
const MAX_DEPTH_DAYS: Record<string, number> = {
  '1m': 7,
  '5m': 58,
  '15m': 58,
  '30m': 58,
  '1h': 720,
};

/**
 * Cuánto puede alejarse la vela del instante pedido, según la temporalidad.
 *
 * En el minuto y en la hora el margen es poco más que la propia vela: pedir el
 * precio de las 15:00 y devolver el de las 14:00 sería inventarse una hora de
 * quietud que no hubo.
 *
 * En la vela diaria el margen es de cinco días, y es a propósito. Es el último
 * recurso: si se llega hasta aquí es que no existe nada más fino, y la
 * alternativa a devolver el último precio establecido no es devolver uno mejor,
 * es no poder liquidar el ejercicio nunca. Cinco días cubren un puente largo
 * -un festivo pegado a un fin de semana- que es justo cuando pasa.
 *
 * Devolverlo no engaña a nadie porque la procedencia viaja con el precio: lleva
 * la marca de cuándo se cruzó de verdad, así que la auditoría del ejercicio
 * enseña que se liquidó contra el cierre del viernes y no contra un martes que
 * nunca existió.
 */
const TOLERANCIA_ABIERTO = { '1m': 30 * 60_000, '1h': 2 * 3_600_000, '1d': 5 * 86_400_000 } as const;

/**
 * Con el mercado cerrado no hay margen que exigir: el último cruce antes del
 * cierre es el precio durante todo el cierre. Cuatro días cubren un puente
 * largo; más allá, la vela diaria ya responde por su cuenta.
 */
const TOLERANCIA_CERRADO = 4 * 86_400_000;

/** Intervalo de Yahoo para cada temporalidad del catálogo. */
const INTERVAL: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  // Yahoo no tiene cuatro horas. Se piden horas y se agrupan de cuatro en
  // cuatro aquí, que es una operación exacta sobre datos reales.
  '4h': '1h',
  '1d': '1d',
  '1w': '1wk',
};

/**
 * Ticker de Yahoo para un instrumento del catálogo.
 *
 * La traducción vive aquí, en el único sitio que conoce los dos vocabularios.
 * Cuando el catálogo ya declara `yahooSymbol` manda ese; si no, se deriva de la
 * clase de activo, que es lo que de verdad decide la forma del ticker.
 */
export function yahooTicker(symbol: string): string | null {
  const meta = getSymbol(symbol);
  if (!meta) return null;
  if (meta.yahooSymbol) return meta.yahooSymbol;
  switch (meta.assetClass) {
    case 'FOREX':
      // Seis letras y nada más: `EURUSD` → `EURUSD=X`.
      return /^[A-Z]{6}$/.test(meta.symbol) ? `${meta.symbol}=X` : null;
    case 'STOCK':
    case 'ETF':
      return meta.upstreamSymbol ?? meta.symbol;
    case 'CRYPTO': {
      // Respaldo por si Binance no responde. `BTCUSD` → `BTC-USD`.
      if (meta.symbol.endsWith('USDT')) return null; // USD is not USDT.
      const base = meta.symbol.replace(/USD$/, '');
      return base && base !== meta.symbol ? `${base}-USD` : null;
    }
    default:
      return null;
  }
}

interface YahooBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface YahooSnapshot {
  price: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  volume: number;
  currency: string;
  sourceTimestamp: number;
  fetchedAt: number;
}

interface ChartResponse {
  chart?: {
    error?: { code?: string; description?: string } | null;
    result?: Array<{
      meta?: Record<string, unknown>;
      timestamp?: number[];
      indicators?: { quote?: Array<Record<string, Array<number | null> | undefined>> };
    }>;
  };
}

const quoteCache = new Map<string, YahooSnapshot>();
const barCache = new Map<string, { bars: YahooBar[]; sourceTimestamp: number; fetchedAt: number }>();
/** Peticiones en vuelo, para que diez lectores simultáneos generen una sola. */
const inflight = new Map<string, Promise<unknown>>();

function share<T>(key: string, run: () => Promise<T>): Promise<T> {
  const prior = inflight.get(key) as Promise<T> | undefined;
  if (prior) return prior;
  const pending = run().finally(() => inflight.delete(key));
  inflight.set(key, pending);
  return pending;
}

async function request(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
      // Sin un agente declarado la respuesta llega vacía en algunos bordes.
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TradingLab/1.0)', Accept: 'application/json' },
    });
    if (response.status === 429) {
      throw new MarketDataError('La fuente limitó la frecuencia de consulta.', 'RATE_LIMITED', 'yahoo');
    }
    if (!response.ok) {
      throw new MarketDataError(`La fuente respondió ${response.status}.`, 'UPSTREAM', 'yahoo');
    }
    return await response.json();
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    throw new MarketDataError('La fuente de mercado no está disponible.', 'UPSTREAM', 'yahoo');
  } finally {
    clearTimeout(timer);
  }
}

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Velas de una respuesta `chart`.
 *
 * Yahoo deja huecos -`null`- en las sesiones sin negociación. Se descartan en
 * lugar de rellenarlos: una vela inventada dentro de un histórico verdadero
 * contamina todo el gráfico, porque ya no se sabe cuál es cuál.
 */
function parseBars(payload: unknown): { bars: YahooBar[]; meta: Record<string, unknown> } {
  const body = payload as ChartResponse;
  const failure = body?.chart?.error;
  if (failure) {
    throw new MarketDataError(failure.description || 'La fuente no reconoce el instrumento.', 'UNKNOWN_SYMBOL', 'yahoo');
  }
  const result = body?.chart?.result?.[0];
  if (!result) throw new MarketDataError('Respuesta de mercado inválida.', 'UPSTREAM', 'yahoo');

  const stamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const series = result.indicators?.quote?.[0] ?? {};
  const bars: YahooBar[] = [];
  for (let index = 0; index < stamps.length; index++) {
    const t = stamps[index];
    const o = series.open?.[index];
    const h = series.high?.[index];
    const l = series.low?.[index];
    const c = series.close?.[index];
    const v = series.volume?.[index];
    if (!Number.isFinite(t) || !positive(o) || !positive(h) || !positive(l) || !positive(c)) continue;
    // Coherencia mínima: el máximo no puede quedar por debajo del cuerpo.
    if (h < Math.max(o, c) || l > Math.min(o, c)) continue;
    const bar = { t: t * 1000, o, h, l, c, v: typeof v === 'number' && v >= 0 ? v : 0 };
    if (bars.length && bar.t <= bars[bars.length - 1].t) continue;
    bars.push(bar);
  }
  return { bars, meta: (result.meta ?? {}) as Record<string, unknown> };
}

/** Agrupa velas de una hora en velas de cuatro. Operación exacta, sin invención. */
function groupBars(bars: YahooBar[], factor: number): YahooBar[] {
  const span = 3_600_000 * factor;
  const grouped: YahooBar[] = [];
  for (const bar of bars) {
    const bucket = Math.floor(bar.t / span) * span;
    const last = grouped[grouped.length - 1];
    if (last && last.t === bucket) {
      last.h = Math.max(last.h, bar.h);
      last.l = Math.min(last.l, bar.l);
      last.c = bar.c;
      last.v += bar.v;
    } else {
      grouped.push({ ...bar, t: bucket });
    }
  }
  return grouped;
}

function snapshotFrom(meta: Record<string, unknown>, bars: YahooBar[]): YahooSnapshot | null {
  const last = bars[bars.length - 1];
  const stamp = Number(meta.regularMarketTime);
  const hasDatedQuote = positive(meta.regularMarketPrice) && Number.isFinite(stamp) && stamp > 0;
  // Price and timestamp must describe the same observation. Reception time is
  // never a substitute for an unknown market timestamp.
  const price = hasDatedQuote ? (meta.regularMarketPrice as number) : last?.c;
  const sourceTimestamp = hasDatedQuote ? stamp * 1000 : last?.t;
  if (!positive(price) || !positive(sourceTimestamp)) return null;
  const previousClose = positive(meta.chartPreviousClose)
    ? (meta.chartPreviousClose as number)
    : positive(meta.previousClose)
      ? (meta.previousClose as number)
      : price;
  return {
    price,
    previousClose,
    dayHigh: positive(meta.regularMarketDayHigh) ? (meta.regularMarketDayHigh as number) : Math.max(price, last?.h ?? price),
    dayLow: positive(meta.regularMarketDayLow) ? (meta.regularMarketDayLow as number) : Math.min(price, last?.l ?? price),
    open: positive(last?.o) ? last!.o : price,
    volume: typeof meta.regularMarketVolume === 'number' && meta.regularMarketVolume >= 0 ? meta.regularMarketVolume : 0,
    currency: typeof meta.currency === 'string' ? meta.currency : 'USD',
    sourceTimestamp,
    fetchedAt: Date.now(),
  };
}

/** Cotización del día, cacheada por ticker. */
async function cachedSnapshot(ticker: string): Promise<YahooSnapshot> {
  const hit = quoteCache.get(ticker);
  const now = Date.now();
  if (hit && now - hit.fetchedAt < QUOTE_TTL_MS) return hit;

  try {
    const fresh = await share(`quote:${ticker}`, async () => {
      const payload = await request(`${API}/chart/${encodeURIComponent(ticker)}?range=1d&interval=5m`);
      const { bars, meta } = parseBars(payload);
      return snapshotFrom(meta, bars);
    });
    if (fresh) {
      quoteCache.set(ticker, fresh);
      return fresh;
    }
  } catch (error) {
    // Un fallo puntual no borra el último precio real conocido, pero tampoco
    // puede servirse indefinidamente como si fuera de ahora.
    if (hit && now - hit.fetchedAt < MAX_STALE_MS) return hit;
    throw error;
  }
  if (hit && now - hit.fetchedAt < MAX_STALE_MS) return hit;
  throw new MarketDataError(`La fuente no tiene cotización para ${ticker}.`, 'UNKNOWN_SYMBOL', 'yahoo');
}

/**
 * Cotizaciones de muchos instrumentos en pocas peticiones.
 *
 * El explorador pide sesenta a la vez. Una petición por instrumento tardaría
 * segundos y agotaría la paciencia de la fuente; `spark` devuelve veinte de
 * golpe con precio y cierre anterior, que es justo lo que la lista enseña.
 */
async function primeFromSpark(tickers: string[]): Promise<void> {
  const pending = tickers.filter((t) => {
    const hit = quoteCache.get(t);
    return !hit || Date.now() - hit.fetchedAt >= QUOTE_TTL_MS;
  });
  if (pending.length === 0) return;

  const chunks: string[][] = [];
  for (let i = 0; i < pending.length; i += SPARK_CHUNK) chunks.push(pending.slice(i, i + SPARK_CHUNK));

  await Promise.allSettled(
    chunks.map((chunk) =>
      share(`spark:${chunk.join(',')}`, async () => {
        const query = chunk.map((t) => encodeURIComponent(t)).join(',');
        const payload = (await request(`${API}/spark?symbols=${query}&range=1d&interval=5m`)) as Record<
          string,
          { symbol?: string; close?: Array<number | null>; timestamp?: number[]; previousClose?: number; chartPreviousClose?: number } | undefined
        >;
        const now = Date.now();
        for (const ticker of chunk) {
          const entry = payload?.[ticker];
          const observations = (entry?.close ?? []).flatMap((close, index) => {
            const timestamp = entry?.timestamp?.[index];
            return positive(close) && positive(timestamp) ? [{ close, timestamp }] : [];
          });
          const closes = observations.map(o => o.close);
          const last = observations[observations.length - 1];
          const price = last?.close;
          if (!positive(price)) continue;
          const previousClose = positive(entry?.previousClose)
            ? entry!.previousClose!
            : positive(entry?.chartPreviousClose)
              ? entry!.chartPreviousClose!
              : price;
          quoteCache.set(ticker, {
            price,
            previousClose,
            // `spark` solo trae cierres, así que el máximo y el mínimo son los
            // de las observaciones recibidas hoy, no el rango oficial de la
            // sesión. Para la lista basta; quien abre el instrumento recibe la
            // cotización completa por la vía de `cachedSnapshot`.
            dayHigh: Math.max(...closes),
            dayLow: Math.min(...closes),
            open: closes[0] ?? price,
            volume: 0,
            currency: 'USD',
            sourceTimestamp: last.timestamp * 1000,
            fetchedAt: now,
          });
        }
        return null;
      }),
    ),
  );
}

export class YahooMarketDataProvider implements MarketDataProvider {
  readonly id = 'yahoo-chart-v1';
  readonly label = 'Yahoo Finance';
  /** Las divisas van al segundo; algunas acciones llegan con retraso. */
  readonly declaredDelaySeconds = 900;
  readonly synthetic = false;
  readonly attribution = { text: 'Datos de mercado por Yahoo Finance', url: 'https://finance.yahoo.com/' };

  supports(symbol: string): boolean {
    return yahooTicker(symbol) !== null;
  }

  private require(symbol: string): string {
    const ticker = yahooTicker(symbol);
    if (!ticker) throw new MarketDataError(`Símbolo no soportado: ${symbol}`, 'UNKNOWN_SYMBOL', this.id);
    return ticker;
  }

  private provenance(symbol: string, sourceTimestamp: number, receivedAt: number, currency: string): DataProvenance {
    const now = Date.now();
    // El estado que se enseña sale de cuándo se cruzó el último precio, no solo
    // del calendario: es lo que evita anunciar como activo un mercado que lleva
    // horas parado por un festivo que la tabla no conoce.
    const session = getSymbol(symbol)?.session;
    const status = session ? observedMarketStatus(session, now, sourceTimestamp) : this.getMarketStatus(symbol, now);
    const age = Math.max(0, now - sourceTimestamp);
    return {
      provider: this.id,
      providerLabel: this.label,
      sourceTimestamp,
      receivedTimestamp: receivedAt,
      latencyMs: age,
      freshness: status === 'OPEN' ? (age < 90_000 ? 'REALTIME' : 'DELAYED') : 'MARKET_CLOSED',
      marketStatus: status,
      currency,
      synthetic: false,
      notice:
        status === 'OPEN'
          ? 'Precio real de mercado, que puede llegar con unos minutos de retraso según el instrumento. Saldo y operaciones exclusivamente virtuales.'
          : 'El mercado está cerrado: este es el último precio real de la sesión anterior y no se moverá hasta la próxima apertura.',
    };
  }

  private toQuote(symbol: string, entry: YahooSnapshot): Quote {
    const meta = getSymbol(symbol);
    // Yahoo snapshots do not provide an order book. Do not invent bid/ask.
    const change = entry.price - entry.previousClose;
    return {
      symbol,
      price: entry.price,
      bid: entry.price,
      ask: entry.price,
      change,
      changePercent: entry.previousClose > 0 ? (change / entry.previousClose) * 100 : 0,
      dayHigh: Math.max(entry.dayHigh, entry.price),
      dayLow: Math.min(entry.dayLow, entry.price),
      previousClose: entry.previousClose,
      volume: entry.volume,
      provenance: this.provenance(symbol, entry.sourceTimestamp, entry.fetchedAt, meta?.quoteCurrency ?? entry.currency),
    };
  }

  async getQuote(symbol: string): Promise<Quote> {
    return this.toQuote(symbol, await cachedSnapshot(this.require(symbol)));
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const supported = symbols.filter((s) => this.supports(s));
    await primeFromSpark(supported.map((s) => this.require(s)));
    const results = await Promise.allSettled(supported.map((s) => this.getQuote(s)));
    return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  }

  /**
   * Serie histórica real, tan atrás como exista el instrumento.
   *
   * Se piden marcas de tiempo explícitas en lugar de un rango con nombre: con
   * `range=max` la fuente decide por su cuenta bajar la granularidad y devuelve
   * ciento sesenta puntos para cuarenta años. Con `period1`/`period2` respeta el
   * intervalo pedido y llegan las dos mil cuatrocientas semanas de verdad.
   */
  async getCandles(params: { symbol: string; timeframe: Timeframe; limit: number; to?: number }): Promise<CandleSeries> {
    const ticker = this.require(params.symbol);
    const interval = INTERVAL[params.timeframe];
    const limit = Math.min(20_000, Math.max(1, params.limit));
    const to = Math.min(params.to ?? Date.now(), Date.now());
    const spanSeconds = TIMEFRAME_SECONDS[params.timeframe];

    // Se pide con holgura, y la holgura es grande a propósito. Una bolsa abre
    // seis horas y media al día, cinco días de siete: trescientas velas de cinco
    // minutos no caben en un día natural, caben en unos seis. Con un margen
    // ajustado, pedir "el último día" del S&P un lunes por la mañana devolvía
    // una serie vacía y el gráfico en blanco.
    const slack = MAX_DEPTH_DAYS[interval] ? 4.5 : 2.2;
    let fromMs = to - limit * spanSeconds * 1000 * slack;
    const depthDays = MAX_DEPTH_DAYS[interval];
    const deepestMs = depthDays ? to - depthDays * 86_400_000 : null;
    if (deepestMs != null) fromMs = Math.max(fromMs, deepestMs);

    const cacheKey = `${ticker}|${interval}|${Math.floor(fromMs / 60000)}|${Math.floor(to / 60000)}`;
    const hit = barCache.get(cacheKey);
    // Una vela diaria cerrada no cambia; una intradía sí. La caché dura lo que
    // dura la vela, con un mínimo razonable.
    const ttl = Math.min(600_000, Math.max(30_000, spanSeconds * 100));
    let entry = hit && Date.now() - hit.fetchedAt < ttl ? hit : undefined;

    if (!entry) {
      try {
        entry = await share(`bars:${cacheKey}`, async () => {
          const fetchFrom = async (since: number) => {
            const payload = await request(
              `${API}/chart/${encodeURIComponent(ticker)}?period1=${Math.max(0, Math.floor(since / 1000))}` +
                `&period2=${Math.floor(to / 1000)}&interval=${interval}&includePrePost=false&events=div%2Csplit`,
            );
            return parseBars(payload);
          };
          let parsed = await fetchFrom(fromMs);
          // Un puente largo o un festivo pueden dejar sin velas incluso una
          // ventana holgada. Antes de dar por vacío el histórico se pregunta por
          // todo lo que la fuente conserva en esa granularidad: es preferible
          // enseñar la última semana negociada que un gráfico en blanco.
          if (parsed.bars.length === 0 && deepestMs != null && deepestMs < fromMs) {
            parsed = await fetchFrom(deepestMs);
          }
          const snapshot = snapshotFrom(parsed.meta, parsed.bars);
          if (snapshot) quoteCache.set(ticker, snapshot);
          return {
            bars: parsed.bars,
            sourceTimestamp: snapshot?.sourceTimestamp ?? parsed.bars[parsed.bars.length - 1]?.t ?? to,
            fetchedAt: Date.now(),
          };
        });
        barCache.set(cacheKey, entry);
        if (barCache.size > 400) barCache.delete(barCache.keys().next().value!);
      } catch (error) {
        if (!hit) throw error;
        entry = hit;
      }
    }

    const bars = params.timeframe === '4h' ? groupBars(entry.bars, 4) : entry.bars;
    if (bars.length === 0) {
      throw new MarketDataError(
        `La fuente no tiene histórico de ${params.symbol} en esta temporalidad.`,
        'UPSTREAM',
        this.id,
      );
    }
    const candles: Candle[] = bars.slice(-limit).map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
    const meta = getSymbol(params.symbol);
    return {
      symbol: params.symbol,
      timeframe: params.timeframe,
      candles,
      provenance: this.provenance(params.symbol, entry.sourceTimestamp, entry.fetchedAt, meta?.quoteCurrency ?? 'USD'),
    };
  }

  /**
   * Precio en un instante concreto.
   *
   * Es la función de la que depende que un ejercicio pueda vencer, y estaba
   * rota para todo lo que no fuera cripto. Buscaba una vela de un minuto junto
   * a la marca pedida y exigía que estuviera a menos de media hora; una acción
   * que vence un sábado -o de madrugada, o en un festivo- no tiene ninguna vela
   * cerca, así que fallaba, la liquidación se abandonaba y **la posición se
   * quedaba abierta para siempre**. Nadie lo veía: el fallo se registraba en un
   * `catch` y el ejercicio simplemente no se resolvía nunca.
   *
   * La corrección parte de algo que ya sabíamos y no estábamos usando: si el
   * mercado estaba cerrado en ese instante, el precio de ese instante **es** el
   * último cruzado antes del cierre. No es una aproximación ni un dato viejo
   * que se sirve por comodidad: es el precio que tenía el instrumento. Lo que
   * no se puede hacer -y se sigue sin hacer- es rellenar un hueco con el
   * mercado abierto, porque ahí sí hubo movimiento que no conocemos.
   *
   * Se busca en tres pasadas, de fina a gruesa, porque la fuente guarda el
   * minuto solo unos días y la hora solo un par de años: un ejercicio de hace
   * una semana necesita la vela horaria, y uno de hace un año, la diaria.
   */
  async getPriceAt(symbol: string, timestampMs: number) {
    const meta = getSymbol(symbol);
    const currency = meta?.quoteCurrency ?? 'USD';
    const now = Date.now();
    if (!Number.isFinite(timestampMs) || timestampMs > now + 1000) {
      throw new MarketDataError('Instante de mercado inválido.', 'UPSTREAM', this.id);
    }
    if (now - timestampMs < 5 * 60_000) {
      const entry = await cachedSnapshot(this.require(symbol));
      return { price: entry.price, provenance: this.provenance(symbol, entry.sourceTimestamp, entry.fetchedAt, currency) };
    }
    /**
     * ¿Se negoció algo entre ese instante y ahora?
     *
     * La pregunta no se le hace a nuestro calendario de sesiones, sino a la
     * fuente. El calendario dice «lunes de 13:30 a 20:00» y no sabe nada de
     * festivos: el 7 de septiembre de 2026 lo daba por abierto y era el Día del
     * Trabajo estadounidense, así que un ejercicio que venciera esa tarde no se
     * podía liquidar y se quedaba abierto para siempre.
     *
     * `regularMarketTime` es la marca del último cruce real. Si el instante que
     * se pide es posterior, entonces desde entonces no se ha negociado nada y el
     * precio de ese instante **es** ese último cruce. No es una aproximación:
     * es lo que valía. Y como viene de la fuente, cubre festivos, medias
     * sesiones y cierres imprevistos sin que tengamos que conocerlos.
     */
    const ultimo = await cachedSnapshot(this.require(symbol)).catch(() => null);
    if (ultimo && timestampMs >= ultimo.sourceTimestamp) {
      return {
        price: ultimo.price,
        provenance: this.provenance(symbol, ultimo.sourceTimestamp, ultimo.fetchedAt, currency),
      };
    }

    // Si el instante es anterior al último cruce, sí hubo mercado por medio y
    // hace falta la vela de verdad. El calendario vuelve a servir aquí solo
    // para saber cuánta holgura es razonable.
    const session = meta?.session;
    const abierto = session ? marketStatusFor(session, timestampMs) === 'OPEN' : true;

    // De fina a gruesa. El minuto da el precio exacto cuando existe; la hora y
    // el día cubren los ejercicios más viejos, para los que la fuente ya no
    // guarda el detalle.
    for (const timeframe of ['1m', '1h', '1d'] as const) {
      let candle;
      try {
        const series = await this.getCandles({ symbol, timeframe, limit: 400, to: timestampMs });
        candle = series.candles.filter((c) => c.t <= timestampMs).at(-1);
      } catch {
        continue;
      }
      if (!candle) continue;

      const distancia = timestampMs - candle.t;
      // Con el mercado cerrado, el último cruce es el precio de ese instante:
      // no se movió. Con el mercado abierto se exige cercanía, porque un hueco
      // ahí esconde movimiento que no conocemos y liquidar contra él falsearía
      // el resultado del ejercicio.
      const tolerancia = abierto ? TOLERANCIA_ABIERTO[timeframe] : TOLERANCIA_CERRADO;
      if (distancia > tolerancia) continue;

      return {
        price: candle.c,
        candle,
        provenance: this.provenance(symbol, candle.t, Date.now(), currency),
      };
    }

    throw new MarketDataError(
      'No hay una observación real en ese instante. No acreditamos un precio que no ocurrió.',
      'UPSTREAM',
      this.id,
    );
  }

  getMarketStatus(symbol: string, at = Date.now()): MarketStatus {
    const session = getSymbol(symbol)?.session;
    return session ? marketStatusFor(session, at) : 'OPEN';
  }

  async search(query: string, limit = 10): Promise<AssetMeta[]> {
    const q = query.trim().toLowerCase();
    return listSymbols()
      .filter((s) => this.supports(s.symbol))
      .filter(
        (s) =>
          !q ||
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.displayTicker ?? '').toLowerCase().includes(q),
      )
      .slice(0, limit);
  }

  async getMeta(symbol: string): Promise<AssetMeta | null> {
    return this.supports(symbol) ? (getSymbol(symbol) ?? null) : null;
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    const started = Date.now();
    try {
      await cachedSnapshot('SPY');
      return { ok: true, latencyMs: Date.now() - started, message: 'Yahoo Finance responde con precios e histórico reales.' };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : 'Yahoo Finance no responde.',
      };
    }
  }
}

/** Para pruebas: vacía las cachés entre casos. */
export function resetYahooCache(): void {
  quoteCache.clear();
  barCache.clear();
  inflight.clear();
}
