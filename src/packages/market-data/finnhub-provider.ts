import type {
  AssetMeta,
  Candle,
  CandleSeries,
  DataProvenance,
  MarketStatus,
  Quote,
  Timeframe,
} from '@tl/types';
import { MarketDataError, type MarketDataProvider } from './provider';
import { getSymbol, listSymbols } from './symbols';
import { marketStatusFor, observedMarketStatus } from './market-hours';

/**
 * Proveedor de acciones y fondos cotizados, sobre Finnhub.
 *
 * El plan gratuito entrega **cotización en tiempo real de instrumentos
 * estadounidenses**, y nada más: ni velas históricas ni divisas. Esta
 * implementación se ciñe a eso y lo declara, en lugar de rellenar los huecos
 * con números plausibles. Lo que no se puede saber, no se inventa.
 *
 * Caché en servidor. Se consulta una vez por símbolo cada `TTL_MS` y todas las
 * personas conectadas leen de ahí. Sin esto, el sondeo del terminal -una
 * petición por segundo y usuario- agotaría la cuota con tres personas a la vez,
 * y el coste crecería con el éxito del producto en lugar de con su tamaño.
 */

const API = 'https://finnhub.io/api/v1';
/** 20 s: con 15 símbolos son 45 peticiones/minuto, bajo el límite gratuito de 60. */
const TTL_MS = 20_000;
const TIMEOUT_MS = 8_000;
/** Una cotización más vieja que esto ya no se sirve ni siquiera como respaldo. */
const MAX_STALE_MS = 15 * 60_000;

interface CachedQuote {
  price: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  /** Marca temporal declarada por Finnhub, en ms. */
  sourceTimestamp: number;
  fetchedAt: number;
}

const cache = new Map<string, CachedQuote>();
/** Peticiones en vuelo, para que diez lectores simultáneos generen una sola. */
const inflight = new Map<string, Promise<CachedQuote | null>>();

function apiKey(): string {
  const key = process.env.FINNHUB_API_KEY?.trim();
  if (!key) {
    throw new MarketDataError(
      'Falta FINNHUB_API_KEY. Sin ella no hay datos reales de acciones y fondos.',
      'NOT_CONFIGURED',
      'finnhub',
    );
  }
  return key;
}

/** Ticker que Finnhub entiende para un símbolo del catálogo. */
function upstreamTicker(symbol: string): string | null {
  return getSymbol(symbol)?.upstreamSymbol ?? null;
}

async function fetchQuote(ticker: string): Promise<CachedQuote | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API}/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey()}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (response.status === 429) {
      throw new MarketDataError('Finnhub limitó la frecuencia de consulta.', 'RATE_LIMITED', 'finnhub');
    }
    if (!response.ok) {
      throw new MarketDataError(`Finnhub respondió ${response.status}.`, 'UPSTREAM', 'finnhub');
    }
    const body = (await response.json()) as {
      c?: number; pc?: number; h?: number; l?: number; o?: number; t?: number; error?: string;
    };
    if (body.error) throw new MarketDataError(body.error, 'UPSTREAM', 'finnhub');
    // `c === 0` es la forma que tiene Finnhub de decir "no tengo dato".
    if (!Number.isFinite(body.c) || (body.c ?? 0) <= 0) return null;

    return {
      price: body.c!,
      previousClose: Number.isFinite(body.pc) && body.pc! > 0 ? body.pc! : body.c!,
      dayHigh: Number.isFinite(body.h) && body.h! > 0 ? body.h! : body.c!,
      dayLow: Number.isFinite(body.l) && body.l! > 0 ? body.l! : body.c!,
      open: Number.isFinite(body.o) && body.o! > 0 ? body.o! : body.c!,
      sourceTimestamp: Number.isFinite(body.t) && body.t! > 0 ? body.t! * 1000 : Date.now(),
      fetchedAt: Date.now(),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cotización cacheada.
 *
 * Con el mercado cerrado la respuesta no cambia durante horas: seguir pidiéndola
 * cada veinte segundos gastaría cuota para recibir el mismo cierre. Aun así se
 * refresca, porque es la única forma de enterarse de que ha vuelto a abrir.
 */
async function cachedQuote(ticker: string): Promise<CachedQuote> {
  const hit = cache.get(ticker);
  const now = Date.now();
  if (hit && now - hit.fetchedAt < TTL_MS) return hit;

  let pending = inflight.get(ticker);
  if (!pending) {
    pending = fetchQuote(ticker).finally(() => inflight.delete(ticker));
    inflight.set(ticker, pending);
  }

  try {
    const fresh = await pending;
    if (fresh) {
      cache.set(ticker, fresh);
      return fresh;
    }
  } catch (error) {
    // Un fallo puntual no debe borrar un precio que sigue siendo el último real
    // conocido, pero tampoco puede servirse indefinidamente como si fuera de ahora.
    if (hit && now - hit.fetchedAt < MAX_STALE_MS) return hit;
    throw error;
  }

  if (hit && now - hit.fetchedAt < MAX_STALE_MS) return hit;
  throw new MarketDataError(`Finnhub no tiene cotización para ${ticker}.`, 'UNKNOWN_SYMBOL', 'finnhub');
}

export class FinnhubMarketDataProvider implements MarketDataProvider {
  readonly id = 'finnhub-quote-v1';
  readonly label = 'Finnhub · mercado de EE. UU.';
  readonly declaredDelaySeconds = TTL_MS / 1000;
  readonly synthetic = false;
  readonly attribution = { text: 'Datos de mercado por Finnhub', url: 'https://finnhub.io/' };

  private provenance(entry: CachedQuote, symbol: string, currency: string): DataProvenance {
    const now = Date.now();
    const age = now - entry.sourceTimestamp;
    const session = getSymbol(symbol)?.session;
    const status = session ? observedMarketStatus(session, now, entry.sourceTimestamp) : 'OPEN';
    return {
      provider: this.id,
      providerLabel: this.label,
      sourceTimestamp: entry.sourceTimestamp,
      receivedTimestamp: entry.fetchedAt,
      latencyMs: Math.max(0, age),
      // Con el mercado cerrado el dato es real y es el último: no está "rancio",
      // simplemente no hay nada nuevo que contar hasta la próxima apertura.
      freshness: status === 'OPEN' ? (age < 60_000 ? 'REALTIME' : 'DELAYED') : 'MARKET_CLOSED',
      marketStatus: status,
      currency,
      synthetic: false,
      notice:
        status === 'OPEN'
          ? 'Precio real del mercado estadounidense, actualizado cada 20 segundos. Saldo y operaciones exclusivamente virtuales.'
          : 'El mercado está cerrado: este es el último precio real de la sesión anterior y no se moverá hasta la próxima apertura.',
    };
  }

  private toQuote(symbol: string, entry: CachedQuote): Quote {
    const meta = getSymbol(symbol);
    const change = entry.price - entry.previousClose;
    return {
      symbol,
      price: entry.price,
      bid: entry.price,
      ask: entry.price,
      change,
      changePercent: entry.previousClose > 0 ? (change / entry.previousClose) * 100 : 0,
      dayHigh: entry.dayHigh,
      dayLow: entry.dayLow,
      previousClose: entry.previousClose,
      volume: 0,
      provenance: this.provenance(entry, symbol, meta?.quoteCurrency ?? 'USD'),
    };
  }

  supports(symbol: string): boolean {
    return upstreamTicker(symbol) !== null;
  }

  async getQuote(symbol: string): Promise<Quote> {
    const ticker = upstreamTicker(symbol);
    if (!ticker) throw new MarketDataError(`Símbolo no soportado: ${symbol}`, 'UNKNOWN_SYMBOL', this.id);
    return this.toQuote(symbol, await cachedQuote(ticker));
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const results = await Promise.allSettled(symbols.map((s) => this.getQuote(s)));
    return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  }

  /**
   * El plan gratuito no incluye velas históricas.
   *
   * Se construye una serie de una sola vela con los datos reales de la sesión
   * -apertura, máximo, mínimo y último- en lugar de fabricar un histórico. Una
   * vela verdadera dice menos que cien, pero no miente.
   */
  async getCandles(params: { symbol: string; timeframe: Timeframe; limit: number; to?: number }): Promise<CandleSeries> {
    const ticker = upstreamTicker(params.symbol);
    if (!ticker) throw new MarketDataError(`Símbolo no soportado: ${params.symbol}`, 'UNKNOWN_SYMBOL', this.id);
    const entry = await cachedQuote(ticker);
    const meta = getSymbol(params.symbol);
    const candle: Candle = {
      t: entry.sourceTimestamp,
      o: entry.open,
      h: entry.dayHigh,
      l: entry.dayLow,
      c: entry.price,
      v: 0,
    };
    return {
      symbol: params.symbol,
      timeframe: params.timeframe,
      candles: [candle],
      provenance: this.provenance(entry, params.symbol, meta?.quoteCurrency ?? 'USD'),
    };
  }

  /**
   * No hay histórico intradía en el plan gratuito, así que solo se puede
   * responder por el precio de ahora. Devolver el actual como si fuera el de un
   * instante pasado falsearía la liquidación de una operación.
   */
  async getPriceAt(symbol: string, timestampMs: number) {
    const ticker = upstreamTicker(symbol);
    if (!ticker) throw new MarketDataError(`Símbolo no soportado: ${symbol}`, 'UNKNOWN_SYMBOL', this.id);
    const entry = await cachedQuote(ticker);
    if (Math.abs(Date.now() - timestampMs) > MAX_STALE_MS) {
      throw new MarketDataError(
        'El plan gratuito de Finnhub no incluye histórico: no podemos acreditar el precio de ese momento.',
        'UPSTREAM',
        this.id,
      );
    }
    const meta = getSymbol(symbol);
    return {
      price: entry.price,
      provenance: this.provenance(entry, symbol, meta?.quoteCurrency ?? 'USD'),
    };
  }

  getMarketStatus(symbol: string, at = Date.now()): MarketStatus {
    const session = getSymbol(symbol)?.session;
    return session ? marketStatusFor(session, at) : 'OPEN';
  }

  async search(query: string, limit = 10): Promise<AssetMeta[]> {
    const q = query.trim().toLowerCase();
    return listSymbols()
      .filter((s) => this.supports(s.symbol))
      .filter((s) => !q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, limit);
  }

  async getMeta(symbol: string): Promise<AssetMeta | null> {
    return this.supports(symbol) ? (getSymbol(symbol) ?? null) : null;
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    const started = Date.now();
    try {
      await cachedQuote('AAPL');
      return { ok: true, latencyMs: Date.now() - started, message: 'Finnhub responde con cotizaciones reales.' };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : 'Finnhub no responde.',
      };
    }
  }
}

/** Para pruebas: vacía la caché entre casos. */
export function resetFinnhubCache(): void {
  cache.clear();
  inflight.clear();
}
