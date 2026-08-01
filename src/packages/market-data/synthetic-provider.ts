import type {
  AssetMeta,
  Candle,
  CandleSeries,
  DataFreshness,
  DataProvenance,
  MarketStatus,
  Quote,
  Timeframe,
} from '@tl/types';
import { TIMEFRAME_SECONDS } from '@tl/types';
import { MarketDataError, type MarketDataProvider } from './provider';
import { candleAt, priceAt, roundToTick, type SeriesParams } from './deterministic';
import { getSymbol, searchSymbols, SYMBOLS, type SymbolSeed } from './symbols';
import { lastOpenTimestamp, marketStatusFor } from './market-hours';

const PROVIDER_ID = 'synthetic-v1';
const PROVIDER_LABEL = 'Serie educativa determinística';

const NOTICE =
  'Precios generados por el motor educativo determinístico de TradingLab. No provienen de un mercado real y no deben usarse para tomar decisiones de inversión.';

function seriesParams(meta: SymbolSeed): SeriesParams {
  return {
    symbol: meta.symbol,
    basePrice: meta.basePrice,
    annualVolatility: meta.annualVolatility,
    annualDrift: meta.annualDrift,
  };
}

function toAssetMeta(s: SymbolSeed): AssetMeta {
  const { basePrice: _b, annualVolatility: _v, annualDrift: _d, ...meta } = s;
  return meta;
}

/**
 * Proveedor de referencia incluido en el repositorio.
 *
 * Se usa cuando no hay credenciales de un proveedor comercial configuradas, y
 * en el entorno de desarrollo y pruebas. Declara `synthetic: true`, de modo
 * que la interfaz siempre muestra el aviso correspondiente.
 */
export class SyntheticMarketDataProvider implements MarketDataProvider {
  readonly id = PROVIDER_ID;
  readonly label = PROVIDER_LABEL;
  readonly declaredDelaySeconds = 0;
  readonly synthetic = true;
  readonly attribution = null;

  /**
   * `receivedAt` es el instante lógico de la consulta, no el reloj de pared.
   * Para una consulta histórica ambos coinciden con el momento pedido, de modo
   * que la latencia refleja el retraso de transporte y no la antigüedad del
   * dato, que ya se comunica con `freshness` y `sourceTimestamp`.
   */
  private provenance(meta: SymbolSeed, sourceTs: number, receivedAt: number, status: MarketStatus): DataProvenance {
    const freshness: DataFreshness = status === 'OPEN' ? 'SIMULATED' : 'MARKET_CLOSED';
    return {
      provider: this.id,
      providerLabel: this.label,
      sourceTimestamp: sourceTs,
      receivedTimestamp: receivedAt,
      // El cálculo es local: la latencia de transporte es efectivamente cero.
      // Fuera de sesión no se acumula latencia: el dato está congelado a propósito.
      latencyMs: status === 'OPEN' ? Math.max(0, Math.min(receivedAt - sourceTs, 60_000)) : 0,
      freshness,
      marketStatus: status,
      currency: meta.quoteCurrency,
      synthetic: true,
      notice: NOTICE,
    };
  }

  private priceFor(meta: SymbolSeed, at: number): { price: number; effectiveAt: number; status: MarketStatus } {
    const status = marketStatusFor(meta.session, at);
    const effectiveAt = status === 'OPEN' ? at : lastOpenTimestamp(meta.session, at);
    const raw = priceAt(seriesParams(meta), effectiveAt);
    return { price: roundToTick(raw, meta.tickSize, meta.precision), effectiveAt, status };
  }

  async getQuote(symbol: string, at?: number): Promise<Quote> {
    const meta = getSymbol(symbol);
    if (!meta) throw new MarketDataError(`Instrumento no disponible: ${symbol}`, 'UNKNOWN_SYMBOL', this.id);
    const now = at ?? Date.now();
    const { price, effectiveAt, status } = this.priceFor(meta, now);

    const halfSpread = (price * meta.spreadBps) / 10000 / 2;
    const dayStart = Date.UTC(
      new Date(effectiveAt).getUTCFullYear(),
      new Date(effectiveAt).getUTCMonth(),
      new Date(effectiveAt).getUTCDate(),
    );
    const previousClose = roundToTick(priceAt(seriesParams(meta), dayStart), meta.tickSize, meta.precision);

    // Máximo y mínimo del día por submuestreo determinístico.
    let dayHigh = -Infinity;
    let dayLow = Infinity;
    const steps = 48;
    const elapsed = Math.max(effectiveAt - dayStart, 60_000);
    for (let i = 0; i <= steps; i++) {
      const p = priceAt(seriesParams(meta), dayStart + (elapsed * i) / steps);
      if (p > dayHigh) dayHigh = p;
      if (p < dayLow) dayLow = p;
    }

    const change = price - previousClose;
    const dayCandle = candleAt(seriesParams(meta), dayStart, elapsed);

    return {
      symbol: meta.symbol,
      price,
      bid: roundToTick(price - halfSpread, meta.tickSize, meta.precision),
      ask: roundToTick(price + halfSpread, meta.tickSize, meta.precision),
      change: Number(change.toFixed(meta.precision)),
      changePercent: Number(((change / previousClose) * 100).toFixed(2)),
      dayHigh: roundToTick(dayHigh, meta.tickSize, meta.precision),
      dayLow: roundToTick(dayLow, meta.tickSize, meta.precision),
      previousClose,
      volume: dayCandle.v,
      provenance: this.provenance(meta, effectiveAt, now, status),
    };
  }

  async getQuotes(symbols: string[], at?: number): Promise<Quote[]> {
    const now = at ?? Date.now();
    const out: Quote[] = [];
    for (const s of symbols) {
      const meta = getSymbol(s);
      if (!meta) continue;
      out.push(await this.getQuote(s, now));
    }
    return out;
  }

  async getCandles(params: {
    symbol: string;
    timeframe: Timeframe;
    limit: number;
    to?: number;
  }): Promise<CandleSeries> {
    const meta = getSymbol(params.symbol);
    if (!meta) throw new MarketDataError(`Instrumento no disponible: ${params.symbol}`, 'UNKNOWN_SYMBOL', this.id);

    const now = Date.now();
    const to = params.to ?? now;
    const limit = Math.min(Math.max(params.limit, 1), 1500);
    const durationMs = TIMEFRAME_SECONDS[params.timeframe] * 1000;

    // Alinea el final al inicio de la vela en curso.
    const lastOpen = Math.floor(to / durationMs) * durationMs;
    const sp = seriesParams(meta);
    const candles: Candle[] = [];

    for (let i = limit - 1; i >= 0; i--) {
      const openTime = lastOpen - i * durationMs;
      const status = marketStatusFor(meta.session, openTime);
      // Fuera de sesión no se generan velas: el gráfico refleja el calendario real.
      if (status === 'CLOSED' || status === 'HOLIDAY') continue;
      const raw = candleAt(sp, openTime, durationMs);
      candles.push({
        t: openTime,
        o: roundToTick(raw.o, meta.tickSize, meta.precision),
        h: roundToTick(raw.h, meta.tickSize, meta.precision),
        l: roundToTick(raw.l, meta.tickSize, meta.precision),
        c: roundToTick(raw.c, meta.tickSize, meta.precision),
        v: raw.v,
      });
    }

    const status = marketStatusFor(meta.session, to);
    return {
      symbol: meta.symbol,
      timeframe: params.timeframe,
      candles,
      provenance: this.provenance(meta, lastOpen, to, status),
    };
  }

  async getPriceAt(symbol: string, timestampMs: number) {
    const meta = getSymbol(symbol);
    if (!meta) throw new MarketDataError(`Instrumento no disponible: ${symbol}`, 'UNKNOWN_SYMBOL', this.id);
    const { price, effectiveAt, status } = this.priceFor(meta, timestampMs);
    return { price, provenance: this.provenance(meta, effectiveAt, timestampMs, status) };
  }

  getMarketStatus(symbol: string, at?: number): MarketStatus {
    const meta = getSymbol(symbol);
    if (!meta) return 'CLOSED';
    return marketStatusFor(meta.session, at ?? Date.now());
  }

  async search(query: string, limit = 20): Promise<AssetMeta[]> {
    return searchSymbols(query, limit).map(toAssetMeta);
  }

  async getMeta(symbol: string): Promise<AssetMeta | null> {
    const s = getSymbol(symbol);
    return s ? toAssetMeta(s) : null;
  }

  async healthCheck() {
    const start = Date.now();
    await this.getQuote(SYMBOLS[0].symbol);
    return {
      ok: true,
      latencyMs: Date.now() - start,
      message: 'Motor determinístico local operativo.',
    };
  }
}
