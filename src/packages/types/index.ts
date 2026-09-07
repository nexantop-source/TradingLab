/**
 * @tl/types — Contratos de dominio compartidos entre web, API y paquetes.
 *
 * Este paquete no importa nada: es la raíz del grafo de dependencias.
 * Toda entidad persistida en Prisma tiene aquí su representación de dominio.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Identidad, planes y roles
// ─────────────────────────────────────────────────────────────────────────────

export const PLANS = ['FREE', 'STANDARD', 'PREMIUM'] as const;
export type PlanId = (typeof PLANS)[number];

export const ROLES = [
  'STUDENT',
  'INSTRUCTOR',
  'CONTENT_EDITOR',
  'SUPPORT',
  'ADVERTISER_MANAGER',
  'FINANCE_ADMIN',
  'COMPLIANCE_ADMIN',
  'SUPER_ADMIN',
] as const;
export type Role = (typeof ROLES)[number];

export const ADMIN_ROLES: Role[] = [
  'INSTRUCTOR',
  'CONTENT_EDITOR',
  'SUPPORT',
  'ADVERTISER_MANAGER',
  'FINANCE_ADMIN',
  'COMPLIANCE_ADMIN',
  'SUPER_ADMIN',
];

export const EXPERIENCE_LEVELS = ['PRINCIPIANTE', 'EXPLORADOR', 'INTERMEDIO', 'AVANZADO'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_LEVEL_LABEL: Record<ExperienceLevel, string> = {
  PRINCIPIANTE: 'Principiante',
  EXPLORADOR: 'Explorador',
  INTERMEDIO: 'Intermedio',
  AVANZADO: 'Avanzado',
};

export const LOCALES = ['es', 'en', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

export const THEMES = ['system', 'dark', 'light', 'high-contrast'] as const;
export type ThemeId = (typeof THEMES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Cuenta DEMO y libro mayor virtual
// ─────────────────────────────────────────────────────────────────────────────

/** Saldo virtual inicial obligatorio, en centavos de USD virtual. Criterio de aceptación #1. */
export const INITIAL_DEMO_BALANCE_CENTS = 1_000_000; // USD 10.000,00 virtuales
export const DEMO_CURRENCY = 'VUSD'; // "Virtual USD" — nunca es dinero real.

export const LEDGER_REASONS = [
  'ACCOUNT_OPENING',
  'SIMULATION_MARGIN_HOLD',
  'SIMULATION_MARGIN_RELEASE',
  'SIMULATION_SETTLEMENT',
  'SIMULATION_FEE',
  'BALANCE_RESET',
  'ADMIN_ADJUSTMENT',
  'CHALLENGE_REWARD',
] as const;
export type LedgerReason = (typeof LEDGER_REASONS)[number];

export interface DemoLedgerEntry {
  id: string;
  demoAccountId: string;
  /** Delta en centavos virtuales. Positivo acredita, negativo debita. */
  amountCents: number;
  /** Saldo resultante tras aplicar el delta. Permite auditar sin recalcular. */
  balanceAfterCents: number;
  reason: LedgerReason;
  reference: string | null;
  memo: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Instrumentos y mercados
// ─────────────────────────────────────────────────────────────────────────────

export const ASSET_CLASSES = ['FOREX', 'CRYPTO', 'STOCK', 'INDEX', 'COMMODITY', 'ETF'] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  FOREX: 'Forex',
  CRYPTO: 'Criptomonedas',
  STOCK: 'Acciones',
  INDEX: 'Índices',
  COMMODITY: 'Commodities',
  ETF: 'ETF',
};

export interface AssetMeta {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  /** Divisa de cotización. */
  quoteCurrency: string;
  /** Decimales de presentación del precio. */
  precision: number;
  /** Tamaño mínimo del incremento de precio. */
  tickSize: number;
  /** Spread virtual educativo, en puntos básicos sobre el precio medio. */
  spreadBps: number;
  /** Sesión de referencia (informativa, en UTC). */
  session: MarketSession;
  /** Nivel de riesgo educativo, 1 (más estable) a 5 (más volátil). */
  educationalRisk: 1 | 2 | 3 | 4 | 5;
  /**
   * Ticker con el que hay que pedir este instrumento al proveedor externo.
   * Ausente cuando ningún proveedor real lo cubre, que es la forma de decir
   * "esto todavía no tiene precio verdadero" sin inventarse uno.
   */
  upstreamSymbol?: string;
  /**
   * Simbolo que se muestra a la persona. Cuando la exposicion se obtiene a
   * traves de un fondo cotizado, aqui va el del fondo: ensenar un precio real
   * bajo una etiqueta que no le corresponde es peor que no tener el dato.
   */
  displayTicker?: string;
  description: string;
  /** Solo disponible a partir de este plan. */
  minPlan: PlanId;
}

export interface MarketSession {
  /** `true` para mercados 24/7 como criptomonedas. */
  alwaysOpen: boolean;
  /** Días de la semana abiertos (0 = domingo). */
  days: number[];
  /** Apertura en minutos desde medianoche UTC. */
  openMinuteUtc: number;
  /** Cierre en minutos desde medianoche UTC. */
  closeMinuteUtc: number;
  label: string;
}

export const MARKET_STATUS = ['OPEN', 'CLOSED', 'PRE_OPEN', 'HOLIDAY'] as const;
export type MarketStatus = (typeof MARKET_STATUS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Datos de mercado
// ─────────────────────────────────────────────────────────────────────────────

export const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800,
};

export interface Candle {
  /** Inicio de la vela en milisegundos epoch UTC. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export const DATA_FRESHNESS = ['REALTIME', 'DELAYED', 'MARKET_CLOSED', 'STALE', 'SIMULATED'] as const;
export type DataFreshness = (typeof DATA_FRESHNESS)[number];

/**
 * Toda respuesta de datos de mercado arrastra su procedencia.
 * Criterio de aceptación #6: fuente y latencia siempre visibles.
 */
export interface DataProvenance {
  provider: string;
  providerLabel: string;
  /** Milisegundos epoch en los que el proveedor generó el dato. */
  sourceTimestamp: number;
  /** Milisegundos epoch en los que nuestro backend lo recibió. */
  receivedTimestamp: number;
  /** Latencia estimada extremo a extremo, en milisegundos. */
  latencyMs: number;
  freshness: DataFreshness;
  marketStatus: MarketStatus;
  currency: string;
  /** `true` cuando el precio no proviene de un mercado real. */
  synthetic: boolean;
  notice: string;
}

export interface Quote {
  symbol: string;
  /** Precio medio. */
  price: number;
  bid: number;
  ask: number;
  /** Variación absoluta contra el cierre de la sesión anterior. */
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  volume: number;
  provenance: DataProvenance;
}

export interface CandleSeries {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  provenance: DataProvenance;
}

// ─────────────────────────────────────────────────────────────────────────────
// Motor de simulación
// ─────────────────────────────────────────────────────────────────────────────

/** Versión del motor. Se persiste en cada simulación para poder auditar. */
export const SIMULATION_ENGINE_VERSION = '1.0.0';

export const SIMULATION_MODES = ['HYPOTHESIS', 'POSITION', 'PORTFOLIO'] as const;
export type SimulationMode = (typeof SIMULATION_MODES)[number];

export const DIRECTIONS = ['BULLISH', 'BEARISH'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const SIMULATION_STATUS = ['PENDING', 'OPEN', 'CLOSED', 'CANCELLED'] as const;
export type SimulationStatus = (typeof SIMULATION_STATUS)[number];

export const SIMULATION_OUTCOMES = ['CORRECT', 'INCORRECT', 'NEUTRAL', 'PENDING'] as const;
export type SimulationOutcome = (typeof SIMULATION_OUTCOMES)[number];

export const CLOSE_REASONS = [
  'EXPIRY',
  'STOP_LOSS',
  'TAKE_PROFIT',
  'MANUAL',
  'PARTIAL',
  'TRAILING_STOP',
  'MARKET_CLOSED',
] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

export const ORDER_TYPES = ['MARKET', 'LIMIT'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const CONFIDENCE_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** Contexto inmutable que se congela al abrir una simulación. */
export interface SimulationContextSnapshot {
  engineVersion: string;
  timeframe: Timeframe;
  visibleIndicators: string[];
  /** Valores de indicadores calculados por el backend en el momento de apertura. */
  indicatorValues: Record<string, number | null>;
  provenance: DataProvenance;
  userTimezone: string;
  chartType: string;
  /** Últimas velas visibles, para poder reconstruir el gráfico en el diario. */
  recentCandles: Candle[];
}

export interface SimulationRecord {
  id: string;
  userId: string;
  demoAccountId: string;
  mode: SimulationMode;
  symbol: string;
  assetClass: AssetClass;
  direction: Direction | null;
  status: SimulationStatus;
  outcome: SimulationOutcome;
  orderType: OrderType;
  /** Monto virtual comprometido, en centavos. */
  stakeCents: number;
  /** Apalancamiento exclusivamente simulado. */
  leverage: number;
  entryPrice: number;
  exitPrice: number | null;
  limitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  trailingStopDistance: number | null;
  /** Comisión/spread virtual cobrado, en centavos. */
  feeCents: number;
  pnlCents: number | null;
  /** Cantidad de unidades del activo (modo POSITION y PORTFOLIO). */
  quantity: number;
  openedAt: string;
  expiresAt: string | null;
  closedAt: string | null;
  closeReason: CloseReason | null;
  rationale: string;
  confidence: ConfidenceLevel;
  perceivedRisk: 1 | 2 | 3 | 4 | 5;
  context: SimulationContextSnapshot;
  engineVersion: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicadores
// ─────────────────────────────────────────────────────────────────────────────

export const INDICATOR_IDS = [
  'SMA20',
  'SMA50',
  'SMA200',
  'EMA12',
  'EMA26',
  'BB20',
  'RSI14',
  'MACD',
  'ATR14',
  'STOCH14',
  'VWAP',
  'VOLUME',
] as const;
export type IndicatorId = (typeof INDICATOR_IDS)[number];

export interface IndicatorDescriptor {
  id: IndicatorId;
  label: string;
  /** `overlay` se dibuja sobre el precio; `pane` en un panel inferior. */
  placement: 'overlay' | 'pane';
  minPlan: PlanId;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Academia
// ─────────────────────────────────────────────────────────────────────────────

export const LESSON_BLOCK_TYPES = [
  'text',
  'callout',
  'example',
  'chart',
  'exercise',
  'checklist',
  'video',
] as const;
export type LessonBlockType = (typeof LESSON_BLOCK_TYPES)[number];

export interface LessonBlock {
  type: LessonBlockType;
  title?: string;
  body: string;
  /** Para bloques `chart`: símbolo y temporalidad a renderizar. */
  symbol?: string;
  timeframe?: Timeframe;
  items?: string[];
  tone?: 'info' | 'warning' | 'success' | 'danger';
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const TRACK_LEVELS = ['BASICO', 'INTERMEDIO', 'AVANZADO'] as const;
export type TrackLevel = (typeof TRACK_LEVELS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Diario educativo
// ─────────────────────────────────────────────────────────────────────────────

export const EMOTIONS = [
  'CALMADO',
  'CONFIADO',
  'ANSIOSO',
  'IMPACIENTE',
  'FRUSTRADO',
  'EUFORICO',
  'DUDOSO',
  'ENFOCADO',
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const EMOTION_LABEL: Record<Emotion, string> = {
  CALMADO: 'Calmado',
  CONFIADO: 'Confiado',
  ANSIOSO: 'Ansioso',
  IMPACIENTE: 'Impaciente',
  FRUSTRADO: 'Frustrado',
  EUFORICO: 'Eufórico',
  DUDOSO: 'Dudoso',
  ENFOCADO: 'Enfocado',
};

// ─────────────────────────────────────────────────────────────────────────────
// Inteligencia artificial
// ─────────────────────────────────────────────────────────────────────────────

export const AI_ANALYSIS_KINDS = [
  'CHART_REVIEW',
  'POST_TRADE',
  'JOURNAL_REVIEW',
  'NEWS_EXPLAINER',
  'CONCEPT',
] as const;
export type AIAnalysisKind = (typeof AI_ANALYSIS_KINDS)[number];

export const UNCERTAINTY_LEVELS = ['ALTA', 'MEDIA', 'BAJA'] as const;
export type UncertaintyLevel = (typeof UNCERTAINTY_LEVELS)[number];

/**
 * Esquema de salida obligatorio del entrenador educativo.
 * Se valida con Zod antes de persistir o mostrar (`packages/ai/schema.ts`).
 */
export interface AIEducationalAnalysis {
  contextSummary: string;
  observedTrend: string;
  bullishEvidence: string[];
  bearishEvidence: string[];
  relevantIndicators: Array<{ name: string; reading: string; interpretation: string }>;
  risks: string[];
  bullishScenario: string;
  bearishScenario: string;
  invalidationConditions: string[];
  questionsForStudent: string[];
  recommendedLesson: { slug: string; title: string; reason: string } | null;
  uncertaintyLevel: UncertaintyLevel;
  sourcesUsed: string[];
  educationalDisclaimer: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Publicidad
// ─────────────────────────────────────────────────────────────────────────────

export const AD_FORMATS = ['BANNER', 'SIDE_CARD', 'NATIVE_CARD', 'SPONSOR_STRIP', 'NEWSLETTER'] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

export const AD_PRICING_MODELS = ['CPM', 'CPC', 'FLAT_MONTHLY', 'FLAT_CAMPAIGN'] as const;
export type AdPricingModel = (typeof AD_PRICING_MODELS)[number];

export const AD_CAMPAIGN_STATUS = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'ENDED', 'REJECTED'] as const;
export type AdCampaignStatus = (typeof AD_CAMPAIGN_STATUS)[number];

export interface AdSlotDescriptor {
  code: string;
  label: string;
  format: AdFormat;
  /** Alto reservado en píxeles: evita layout shift (CLS). */
  reservedHeight: number;
  surface: string;
  description: string;
}

export interface ServedAd {
  creativeId: string;
  campaignId: string;
  advertiserName: string;
  headline: string;
  body: string;
  ctaLabel: string;
  destinationUrl: string;
  imageUrl: string | null;
  format: AdFormat;
  /** Siempre `true`: todo espacio comercial se etiqueta. */
  labeled: true;
  disclosure: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de tipo
// ─────────────────────────────────────────────────────────────────────────────

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResult<T> = ApiOk<T> | ApiErr;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  plan: PlanId;
  locale: Locale;
  timezone: string;
  onboardingCompleted: boolean;
  experienceLevel: ExperienceLevel;
}
