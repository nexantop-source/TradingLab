import type {
  Candle,
  CandleSeries,
  Quote,
  Timeframe,
  MarketStatus,
  AssetMeta,
  DataProvenance,
} from '@tl/types';

/**
 * Contrato que debe cumplir cualquier proveedor de datos de mercado.
 *
 * La plataforma nunca habla directamente con un proveedor: siempre lo hace a
 * través de esta interfaz. Cambiar de proveedor es registrar otra
 * implementación en `registry.ts` (criterio de aceptación #22).
 */
export interface MarketDataProvider {
  /** Identificador estable, usado en auditoría y en `DataProvenance.provider`. */
  readonly id: string;
  /** Nombre legible mostrado al usuario junto al gráfico. */
  readonly label: string;
  /** Latencia declarada del plan contratado, en segundos. */
  readonly declaredDelaySeconds: number;
  /** `true` cuando los precios no provienen de un mercado real. */
  readonly synthetic: boolean;
  /** Atribución obligatoria por licencia, si la hay. Nunca debe ocultarse. */
  readonly attribution: { text: string; url: string } | null;

  /** Cotización puntual. */
  getQuote(symbol: string, at?: number): Promise<Quote>;

  /** Varias cotizaciones en una sola llamada (para watchlists). */
  getQuotes(symbols: string[], at?: number): Promise<Quote[]>;

  /** Serie histórica OHLCV. */
  getCandles(params: {
    symbol: string;
    timeframe: Timeframe;
    limit: number;
    /** Marca final de la serie, en ms epoch. Por defecto, ahora. */
    to?: number;
  }): Promise<CandleSeries>;

  /**
   * Precio en un instante concreto. El motor de simulación lo usa para
   * liquidar operaciones de forma determinística y auditable.
   */
  getPriceAt(symbol: string, timestampMs: number): Promise<{ price: number; provenance: DataProvenance; candle?: Candle }>;

  /** Estado del mercado del instrumento. */
  getMarketStatus(symbol: string, at?: number): MarketStatus;

  /** Búsqueda de instrumentos. */
  search(query: string, limit?: number): Promise<AssetMeta[]>;

  /** Metadatos de un instrumento. */
  getMeta(symbol: string): Promise<AssetMeta | null>;

  /** Comprobación de salud usada por el panel administrativo. */
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; message: string }>;
}

/** Error normalizado para que la capa superior no dependa del proveedor. */
export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly code: 'UNKNOWN_SYMBOL' | 'RATE_LIMITED' | 'UPSTREAM' | 'NOT_CONFIGURED',
    readonly provider: string,
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}
