import type {
  AssetMeta,
  CandleSeries,
  DataProvenance,
  MarketStatus,
  Quote,
  Timeframe,
} from '@tl/types';
import { MarketDataError, type MarketDataProvider } from './provider';
import { BinanceMarketDataProvider, binancePair } from './binance-provider';
import { FinnhubMarketDataProvider } from './finnhub-provider';
import { getSymbol, listSymbols } from './symbols';

/**
 * Enrutador de instrumentos a su fuente real.
 *
 * Ninguna fuente gratuita cubre todas las clases de activo, así que cada
 * instrumento va a la que de verdad lo tiene:
 *
 *   · cripto → Binance, en tiempo real y sin clave;
 *   · acciones y fondos cotizados → Finnhub, en tiempo real de EE. UU.
 *
 * Lo importante es lo que **no** hace: un instrumento sin fuente real no cae a
 * la simulación por la puerta de atrás. Falla y lo dice. Un precio inventado
 * presentado junto a precios verdaderos contamina a todos los demás, porque la
 * persona ya no sabe cuál de las dos cosas está mirando.
 */
export class CompositeMarketDataProvider implements MarketDataProvider {
  readonly id = 'composite-real-v1';
  readonly label = 'Mercado real';
  readonly declaredDelaySeconds = 20;
  readonly synthetic = false;
  readonly attribution = { text: 'Datos de Binance y Finnhub', url: 'https://finnhub.io/' };

  private readonly binance = new BinanceMarketDataProvider();
  private readonly finnhub = new FinnhubMarketDataProvider();

  /**
   * Fuente que cubre un instrumento, o `null` si ninguna lo cubre.
   *
   * La clase de activo decide, no el ticker: una cripto va a Binance aunque su
   * identificador interno diga `BTCUSD`, porque el par que existe de verdad es
   * `BTCUSDT` y esa traduccion la hace `upstreamSymbol`.
   */
  private route(symbol: string): MarketDataProvider | null {
    // Se comprueba que Binance tenga par de verdad, no solo que el catalogo
    // diga que es cripto: sin esa comprobacion el proveedor caeria a su motor
    // sintetico en silencio, que es justo lo que este enrutador debe impedir.
    if (binancePair(symbol)) return this.binance;
    return getSymbol(symbol)?.upstreamSymbol ? this.finnhub : null;
  }

  private require(symbol: string): MarketDataProvider {
    const provider = this.route(symbol);
    if (!provider) {
      throw new MarketDataError(
        `Todavía no tenemos una fuente real para ${symbol}. No mostramos un precio inventado en su lugar.`,
        'UNKNOWN_SYMBOL',
        this.id,
      );
    }
    return provider;
  }

  /** Instrumentos con precio verdadero. El explorador solo debería ofrecer estos. */
  supportedSymbols(): AssetMeta[] {
    return listSymbols().filter((s) => this.route(s.symbol) !== null);
  }

  async getQuote(symbol: string, at?: number): Promise<Quote> {
    return this.require(symbol).getQuote(symbol, at);
  }

  async getQuotes(symbols: string[], at?: number): Promise<Quote[]> {
    const results = await Promise.allSettled(symbols.map((s) => this.getQuote(s, at)));
    return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  }

  async getCandles(params: { symbol: string; timeframe: Timeframe; limit: number; to?: number }): Promise<CandleSeries> {
    return this.require(params.symbol).getCandles(params);
  }

  async getPriceAt(symbol: string, timestampMs: number): Promise<{ price: number; provenance: DataProvenance }> {
    return this.require(symbol).getPriceAt(symbol, timestampMs);
  }

  getMarketStatus(symbol: string, at = Date.now()): MarketStatus {
    return this.route(symbol)?.getMarketStatus(symbol, at) ?? 'CLOSED';
  }

  async search(query: string, limit = 10): Promise<AssetMeta[]> {
    const q = query.trim().toLowerCase();
    return this.supportedSymbols()
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
    return this.route(symbol) ? (getSymbol(symbol) ?? null) : null;
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    const started = Date.now();
    const [crypto, equities] = await Promise.all([this.binance.healthCheck(), this.finnhub.healthCheck()]);
    const ok = crypto.ok && equities.ok;
    return {
      ok,
      latencyMs: Date.now() - started,
      message: ok
        ? 'Binance y Finnhub responden con precios reales.'
        : `Cripto: ${crypto.message} · Acciones y fondos: ${equities.message}`,
    };
  }
}
