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
import { YahooMarketDataProvider, yahooTicker } from './yahoo-provider';
import { FxFallbackProvider } from './fx-fallback-provider';
import { getSymbol, listSymbols } from './symbols';

/**
 * Enrutador de instrumentos a su fuente real.
 *
 * Ninguna fuente gratuita cubre todas las clases de activo, así que cada
 * instrumento va a la que de verdad lo tiene:
 *
 *   · cripto → Binance, observación por segundo y sin clave;
 *   · divisas, índices, materias primas, acciones y fondos → Yahoo Finance,
 *     que es la única gratuita que además entrega el histórico completo;
 *   · acciones y fondos estadounidenses → Finnhub como respaldo de cotización
 *     cuando Yahoo falla, porque tener dos fuentes para lo mismo es lo que
 *     evita que una caída deje la lista vacía.
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
  readonly attribution = { text: 'Datos de Binance, Yahoo Finance y Finnhub', url: 'https://finance.yahoo.com/' };

  private readonly binance = new BinanceMarketDataProvider();
  private readonly yahoo = new YahooMarketDataProvider();
  private readonly finnhub = new FinnhubMarketDataProvider();
  private readonly fxFallback = new FxFallbackProvider();

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
    if (yahooTicker(symbol)) return this.yahoo;
    return getSymbol(symbol)?.upstreamSymbol ? this.finnhub : null;
  }

  /**
   * Respaldo de cotización, solo donde de verdad existe otra fuente.
   *
   * Yahoo cubre casi todo el catálogo, pero es una API no publicada que bloquea
   * rangos de centros de datos de vez en cuando. Si nos cierra la puerta desde
   * producción, el usuario pierde el 80 % de la lista por una causa que no
   * tiene nada que ver con él, así que donde hay una segunda fuente se usa:
   * Finnhub para acciones y fondos de Estados Unidos, y una referencia diaria
   * para divisas. Índices y materias primas no tienen respaldo gratuito: ahí se
   * falla y se dice, que es lo que toca cuando no se sabe el precio.
   */
  private backup(symbol: string, primary: MarketDataProvider): MarketDataProvider | null {
    if (primary !== this.yahoo) return null;
    if (getSymbol(symbol)?.upstreamSymbol) return this.finnhub;
    return this.fxFallback.supports(symbol) ? this.fxFallback : null;
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
    const primary = this.require(symbol);
    try {
      return await primary.getQuote(symbol, at);
    } catch (error) {
      const backup = this.backup(symbol, primary);
      if (!backup) throw error;
      return backup.getQuote(symbol, at);
    }
  }

  /**
   * Varias cotizaciones a la vez.
   *
   * Se agrupan por fuente antes de pedirlas para que cada una use su propia
   * llamada por lotes. El explorador pide sesenta instrumentos: sesenta
   * peticiones sueltas tardan segundos y agotan la cuota, una por lote no.
   */
  async getQuotes(symbols: string[], at?: number): Promise<Quote[]> {
    const byProvider = new Map<MarketDataProvider, string[]>();
    for (const symbol of symbols) {
      const provider = this.route(symbol);
      if (!provider) continue;
      const bucket = byProvider.get(provider);
      if (bucket) bucket.push(symbol);
      else byProvider.set(provider, [symbol]);
    }
    const settled = await Promise.allSettled(
      [...byProvider].map(([provider, group]) => provider.getQuotes(group, at)),
    );
    const quotes = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

    // Lo que no volvió, al respaldo. Este camino -el que usa el explorador para
    // pedir el catálogo entero- no tenía ninguno: bastaba que la fuente
    // principal fallara para que doscientos sesenta y ocho instrumentos
    // desaparecieran de la lista, incluidos los ciento setenta y tres que la
    // segunda fuente sí sabe cotizar. `getQuote` sí caía al respaldo, así que
    // abrir un instrumento funcionaba y encontrarlo no: la peor combinación.
    const answered = new Set(quotes.map((q) => q.symbol));
    const pending = new Map<MarketDataProvider, string[]>();
    for (const symbol of symbols) {
      if (answered.has(symbol)) continue;
      const primary = this.route(symbol);
      const backup = primary ? this.backup(symbol, primary) : null;
      if (!backup) continue;
      const bucket = pending.get(backup);
      if (bucket) bucket.push(symbol);
      else pending.set(backup, [symbol]);
    }
    if (pending.size === 0) return quotes;

    const rescued = await Promise.allSettled(
      [...pending].map(([provider, group]) => provider.getQuotes(group, at)),
    );
    return [...quotes, ...rescued.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))];
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
    const [crypto, broad] = await Promise.all([this.binance.healthCheck(), this.yahoo.healthCheck()]);
    const ok = crypto.ok && broad.ok;
    return {
      ok,
      latencyMs: Date.now() - started,
      message: ok
        ? 'Binance y Yahoo Finance responden con precios e histórico reales.'
        : `Cripto: ${crypto.message} · Resto del mercado: ${broad.message}`,
    };
  }
}
