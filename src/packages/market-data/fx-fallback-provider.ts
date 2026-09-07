import type {
  AssetMeta,
  CandleSeries,
  DataProvenance,
  MarketStatus,
  Quote,
  Timeframe,
} from '@tl/types';
import { MarketDataError, type MarketDataProvider } from './provider';
import { getSymbol, listSymbols } from './symbols';
import { marketStatusFor } from './market-hours';

/**
 * Red de seguridad para las divisas.
 *
 * Yahoo Finance cubre los cincuenta pares del catálogo y es la fuente
 * principal, pero es una API no publicada que bloquea rangos de centros de
 * datos con cierta frecuencia. Si nos cierra la puerta desde el servidor de
 * producción, el usuario deja de ver la mitad del catálogo sin que la causa
 * tenga nada que ver con él.
 *
 * Esto no es un segundo proveedor: es un respaldo, y se comporta como tal.
 *
 *   · **Solo cotiza.** No hay histórico, así que `getCandles` falla en lugar de
 *     devolver una serie inventada. Un gráfico en blanco con un motivo escrito
 *     es mejor que una línea que no ocurrió.
 *   · **Dice lo que es.** La referencia se publica una vez al día, así que la
 *     procedencia sale como `DELAYED` y el aviso lo explica. No se disfraza de
 *     precio de mercado en directo.
 *   · **Una sola petición.** La fuente entrega todas las monedas contra el
 *     dólar de golpe, y los cruces se calculan aquí: EUR/JPY es JPY/USD
 *     dividido entre EUR/USD.
 *
 * Sin clave y sin coste: https://open.er-api.com
 */

const API = 'https://open.er-api.com/v6/latest/USD';
/** La referencia cambia una vez al día. Pedirla más a menudo no da nada nuevo. */
const TTL_MS = 60 * 60_000;
const TIMEOUT_MS = 8_000;

interface RateTable {
  rates: Record<string, number>;
  /** Marca de la publicación declarada por la fuente, en ms. */
  publishedAt: number;
  fetchedAt: number;
}

let table: RateTable | null = null;
let inflight: Promise<RateTable> | null = null;

async function loadRates(): Promise<RateTable> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API, { signal: controller.signal, cache: 'no-store', redirect: 'error' });
    if (!response.ok) {
      throw new MarketDataError(`La fuente de respaldo respondió ${response.status}.`, 'UPSTREAM', 'fx-fallback');
    }
    const body = (await response.json()) as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number };
    if (body.result !== 'success' || !body.rates || typeof body.rates !== 'object') {
      throw new MarketDataError('La fuente de respaldo no devolvió tipos de cambio.', 'UPSTREAM', 'fx-fallback');
    }
    const rates: Record<string, number> = { USD: 1 };
    for (const [code, value] of Object.entries(body.rates)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) rates[code] = value;
    }
    const published = Number(body.time_last_update_unix);
    return {
      rates,
      publishedAt: Number.isFinite(published) && published > 0 ? published * 1000 : Date.now(),
      fetchedAt: Date.now(),
    };
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    throw new MarketDataError('La fuente de respaldo de divisas no está disponible.', 'UPSTREAM', 'fx-fallback');
  } finally {
    clearTimeout(timer);
  }
}

async function rates(): Promise<RateTable> {
  if (table && Date.now() - table.fetchedAt < TTL_MS) return table;
  inflight ??= loadRates()
    .then((fresh) => {
      table = fresh;
      return fresh;
    })
    .finally(() => {
      inflight = null;
    });
  try {
    return await inflight;
  } catch (error) {
    // Una tabla vieja sigue siendo un tipo de cambio real; una ausencia no lo
    // es. Se sirve mientras tenga menos de un día, y el aviso ya dice que es
    // una referencia diaria.
    if (table && Date.now() - table.fetchedAt < 24 * 60 * 60_000) return table;
    throw error;
  }
}

/** Un par solo se puede cotizar si la tabla trae sus dos monedas. */
function crossRate(symbol: string, rateTable: Record<string, number>): number | null {
  if (!/^[A-Z]{6}$/.test(symbol)) return null;
  const base = rateTable[symbol.slice(0, 3)];
  const quote = rateTable[symbol.slice(3)];
  if (!base || !quote) return null;
  return quote / base;
}

export class FxFallbackProvider implements MarketDataProvider {
  readonly id = 'erapi-fx-v1';
  readonly label = 'Referencia diaria de divisas';
  /** Una publicación al día: el retraso declarado es el peor caso. */
  readonly declaredDelaySeconds = 24 * 3600;
  readonly synthetic = false;
  readonly attribution = { text: 'Tipos de cambio de open.er-api.com', url: 'https://www.exchangerate-api.com' };

  supports(symbol: string): boolean {
    const meta = getSymbol(symbol);
    return meta?.assetClass === 'FOREX' && /^[A-Z]{6}$/.test(meta.symbol);
  }

  private provenance(symbol: string, entry: RateTable, currency: string): DataProvenance {
    const session = getSymbol(symbol)?.session;
    const status = session ? marketStatusFor(session, Date.now()) : 'OPEN';
    return {
      provider: this.id,
      providerLabel: this.label,
      sourceTimestamp: entry.publishedAt,
      receivedTimestamp: entry.fetchedAt,
      latencyMs: Math.max(0, Date.now() - entry.publishedAt),
      // Nunca `REALTIME`: es una referencia diaria y decir otra cosa sería
      // exactamente el problema que este paquete existe para evitar.
      freshness: status === 'OPEN' ? 'DELAYED' : 'MARKET_CLOSED',
      marketStatus: status,
      currency,
      synthetic: false,
      notice:
        'Referencia diaria de tipo de cambio, no una cotización en directo. Se usa cuando la fuente ' +
        'principal de divisas no responde, para que el instrumento siga teniendo un precio real.',
    };
  }

  async getQuote(symbol: string): Promise<Quote> {
    const entry = await rates();
    const price = crossRate(symbol.toUpperCase(), entry.rates);
    if (price == null) {
      throw new MarketDataError(`La referencia diaria no cubre ${symbol}.`, 'UNKNOWN_SYMBOL', this.id);
    }
    const meta = getSymbol(symbol);
    const spread = (meta?.spreadBps ?? 4) / 20000;
    return {
      symbol: meta?.symbol ?? symbol.toUpperCase(),
      price,
      bid: price * (1 - spread),
      ask: price * (1 + spread),
      // No hay cierre anterior en esta fuente, y restar contra el propio precio
      // daría un cero que parece un dato. Se declara sin variación.
      change: 0,
      changePercent: 0,
      dayHigh: price,
      dayLow: price,
      previousClose: price,
      volume: 0,
      provenance: this.provenance(symbol, entry, meta?.quoteCurrency ?? symbol.slice(3)),
    };
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const settled = await Promise.allSettled(symbols.filter((s) => this.supports(s)).map((s) => this.getQuote(s)));
    return settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  }

  /** Sin histórico. Un gráfico en blanco con motivo, antes que una línea falsa. */
  async getCandles(params: { symbol: string; timeframe: Timeframe; limit: number }): Promise<CandleSeries> {
    throw new MarketDataError(
      `La referencia diaria de divisas no tiene histórico de ${params.symbol}.`,
      'UPSTREAM',
      this.id,
    );
  }

  async getPriceAt(symbol: string, timestampMs: number) {
    // Solo el presente. Liquidar un ejercicio pasado con la referencia de hoy
    // falsearía el resultado, y ese número acaba en el diario de alguien.
    if (Date.now() - timestampMs > 15 * 60_000) {
      throw new MarketDataError(
        'La referencia diaria no puede acreditar el precio de un instante pasado.',
        'UPSTREAM',
        this.id,
      );
    }
    const quote = await this.getQuote(symbol);
    return { price: quote.price, provenance: quote.provenance };
  }

  getMarketStatus(symbol: string, at = Date.now()): MarketStatus {
    const session = getSymbol(symbol)?.session;
    return session ? marketStatusFor(session, at) : 'OPEN';
  }

  async search(query: string, limit = 10): Promise<AssetMeta[]> {
    const q = query.trim().toLowerCase();
    return listSymbols('FOREX')
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
      await this.getQuote('EURUSD');
      return { ok: true, latencyMs: Date.now() - started, message: 'Referencia diaria de divisas disponible.' };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : 'Referencia de divisas no disponible.',
      };
    }
  }
}

/** Para pruebas: olvida la tabla cacheada. */
export function resetFxFallbackCache(): void {
  table = null;
  inflight = null;
}
