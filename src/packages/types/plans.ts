import type { PlanId, IndicatorId } from './index';

/**
 * Matriz de derechos por plan. Es la única fuente de verdad: la UI, la API y
 * el panel administrativo leen de aquí. Cambiar un límite aquí lo cambia en
 * todas partes.
 */
export interface PlanEntitlements {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  /** Simulaciones que se pueden abrir por día. `null` = sin límite fijo (uso razonable). */
  simulationsPerDay: number | null;
  /** Análisis de IA por día. `null` cuando el límite es mensual. */
  aiAnalysesPerDay: number | null;
  /** Análisis de IA por mes. `null` cuando el límite es diario. */
  aiAnalysesPerMonth: number | null;
  /** Días de historial consultable. */
  historyDays: number;
  /** Portafolios DEMO simultáneos. */
  portfolios: number;
  /** Alertas activas simultáneas. */
  alerts: number;
  /** Reinicios del saldo virtual por mes. */
  balanceResetsPerMonth: number;
  indicators: IndicatorId[];
  simulationModes: Array<'HYPOTHESIS' | 'POSITION' | 'PORTFOLIO'>;
  /** Latencia máxima tolerada del dato, en segundos. 0 = tiempo real si el proveedor lo permite. */
  maxDataDelaySeconds: number;
  /** Densidad publicitaria. `none` para Premium (criterio de aceptación #12). */
  adDensity: 'priority' | 'reduced' | 'none';
  interstitials: false;
  features: {
    journalFull: boolean;
    advancedStats: boolean;
    backtesting: 'none' | 'basic' | 'advanced';
    certificates: 'none' | 'standard' | 'verified';
    exportCsv: boolean;
    exportPdf: boolean;
    multiTimeframeAI: boolean;
    strategyComparison: boolean;
    privateTournaments: boolean;
    weeklyReports: boolean;
    prioritySupport: boolean;
    earlyAccess: boolean;
  };
  /** Textos de la tabla de comparación de la landing. */
  highlights: string[];
}

const BASIC_INDICATORS: IndicatorId[] = ['SMA20', 'SMA50', 'EMA12', 'RSI14', 'VOLUME'];
const ADVANCED_INDICATORS: IndicatorId[] = [
  ...BASIC_INDICATORS,
  'SMA200',
  'EMA26',
  'BB20',
  'MACD',
  'ATR14',
  'STOCH14',
  'VWAP',
];

export const PLAN_ENTITLEMENTS: Record<PlanId, PlanEntitlements> = {
  FREE: {
    id: 'FREE',
    name: 'Explore',
    tagline: 'Conoce, aprende y prueba tu primera idea.',
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    simulationsPerDay: 2,
    aiAnalysesPerDay: null,
    aiAnalysesPerMonth: 3,
    historyDays: 7,
    portfolios: 1,
    alerts: 1,
    balanceResetsPerMonth: 1,
    indicators: ['SMA20', 'VOLUME'],
    simulationModes: ['HYPOTHESIS', 'POSITION', 'PORTFOLIO'],
    maxDataDelaySeconds: 900,
    adDensity: 'priority',
    interstitials: false,
    features: {
      journalFull: true,
      advancedStats: false,
      backtesting: 'none',
      certificates: 'none',
      exportCsv: false,
      exportPdf: false,
      multiTimeframeAI: false,
      strategyComparison: false,
      privateTournaments: false,
      weeklyReports: false,
      prioritySupport: false,
      earlyAccess: false,
    },
    highlights: [
      'USD 10.000 virtuales al crear la cuenta',
      'Hasta 2 simulaciones por día',
      'Práctica cripto con datos reales en los pares habilitados',
      'Datos gratuitos con latencia indicada en pantalla',
      'Academia básica',
      '3 análisis educativos con IA al mes',
      'Historial de 7 días',
      'Diario educativo completo',
      'Un portafolio DEMO',
      'Indicadores básicos',
      'Retos públicos',
      'Publicidad programática y patrocinada, siempre etiquetada',
      'Un reinicio de saldo virtual al mes',
    ],
  },
  STANDARD: {
    id: 'STANDARD',
    name: 'Plus',
    tagline: 'Aprende y practica con una rutina propia.',
    priceMonthlyUsd: 5.99,
    priceYearlyUsd: 59.99,
    simulationsPerDay: 20,
    aiAnalysesPerDay: null,
    aiAnalysesPerMonth: 60,
    historyDays: 365,
    portfolios: 1,
    alerts: 25,
    balanceResetsPerMonth: 4,
    indicators: ADVANCED_INDICATORS,
    simulationModes: ['HYPOTHESIS', 'POSITION', 'PORTFOLIO'],
    maxDataDelaySeconds: 0,
    adDensity: 'none',
    interstitials: false,
    features: {
      journalFull: true,
      advancedStats: true,
      backtesting: 'none',
      certificates: 'standard',
      exportCsv: false,
      exportPdf: false,
      multiTimeframeAI: false,
      strategyComparison: false,
      privateTournaments: false,
      weeklyReports: false,
      prioritySupport: false,
      earlyAccess: false,
    },
    highlights: [
      'Todo lo incluido en Explore',
      'Certificado al completar cada ruta formativa',
      'Hasta 20 simulaciones por día',
      'Más activos disponibles',
      'Datos en tiempo real cuando el proveedor lo permite',
      'Hasta 60 análisis con IA al mes',
      'Indicadores avanzados',
      'Estadísticas avanzadas',
      'Academia intermedia',
      'Historial consultable durante 365 días',
      'Cuatro reinicios de saldo virtual al mes',
      'Una experiencia sin publicidad',
      'Soporte estándar',
    ],
  },
  PREMIUM: {
    id: 'PREMIUM',
    name: 'Pro',
    tagline: 'Profundiza en tu formación y revisa tus decisiones.',
    priceMonthlyUsd: 19.99,
    priceYearlyUsd: 199.99,
    simulationsPerDay: null,
    aiAnalysesPerDay: null,
    aiAnalysesPerMonth: 300,
    historyDays: 3650,
    portfolios: 1,
    alerts: 200,
    balanceResetsPerMonth: 10,
    indicators: ADVANCED_INDICATORS,
    simulationModes: ['HYPOTHESIS', 'POSITION', 'PORTFOLIO'],
    maxDataDelaySeconds: 0,
    adDensity: 'none',
    interstitials: false,
    features: {
      journalFull: true,
      advancedStats: true,
      backtesting: 'none',
      certificates: 'verified',
      exportCsv: false,
      exportPdf: false,
      multiTimeframeAI: false,
      strategyComparison: false,
      privateTournaments: false,
      weeklyReports: false,
      prioritySupport: false,
      earlyAccess: false,
    },
    highlights: [
      'Todo lo incluido en Plus',
      'Simulaciones sin límite fijo, bajo uso razonable',
      'Certificados con verificación pública, comprobables por terceros',
      'Academia completa',
      'Hasta 300 análisis educativos con IA al mes',
      'Historial consultable durante 10 años',
      'Diez reinicios de saldo virtual al mes',
    ],
  },
};

export const PLAN_ORDER: Record<PlanId, number> = { FREE: 0, STANDARD: 1, PREMIUM: 2 };

export function planAtLeast(plan: PlanId, required: PlanId): boolean {
  return PLAN_ORDER[plan] >= PLAN_ORDER[required];
}

export function entitlements(plan: PlanId): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan];
}

/** Descuento porcentual del plan anual frente a doce mensualidades. */
export function yearlyDiscountPercent(plan: PlanId): number {
  const p = PLAN_ENTITLEMENTS[plan];
  if (p.priceMonthlyUsd === 0) return 0;
  const full = p.priceMonthlyUsd * 12;
  return Math.round(((full - p.priceYearlyUsd) / full) * 100);
}

/** Duración en días de la prueba de Premium. */
export const PREMIUM_TRIAL_DAYS = 7;
