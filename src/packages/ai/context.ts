import type { AIAnalysisKind, Candle, DataProvenance, Timeframe } from '@tl/types';

/**
 * Construcción del contexto que se envía al modelo.
 *
 * Principio: se envía lo mínimo necesario, ya calculado y verificado por el
 * backend. El modelo no recibe identificadores de usuario, correo, ni ningún
 * dato personal; solo el contexto de mercado y el texto que el propio
 * estudiante escribió.
 */

export interface MarketContext {
  symbol: string;
  assetName: string;
  assetClass: string;
  timeframe: Timeframe;
  currentPrice: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  /** Últimas velas, recortadas. Suficientes para describir estructura reciente. */
  candles: Candle[];
  /** Lecturas de indicadores calculadas por el backend. */
  indicators: Record<string, number | null>;
  provenance: DataProvenance;
  /** Eventos económicos próximos relevantes para el instrumento. */
  upcomingEvents: Array<{ title: string; timeIso: string; impact: string }>;
}

export interface TradeContext {
  mode: string;
  direction: string | null;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  leverage: number;
  stakeUsd: number;
  riskReward: number | null;
  outcome: string;
  pnlUsd: number | null;
  durationMinutes: number | null;
  /** Motivo escrito por el estudiante (ya saneado). */
  studentRationale: string;
  confidence: string;
  perceivedRisk: number;
}

export interface JournalContext {
  totalSimulations: number;
  hitRatePercent: number;
  sampleReliability: string;
  stopLossUsagePercent: number;
  averageRiskPercent: number;
  averageRiskReward: number | null;
  impulsivePercent: number;
  averageLeverage: number;
  disciplineScore: number;
  repeatedMistakes: string[];
  recentEntries: Array<{ emotionBefore: string; emotionAfter: string; lesson: string; mistake: string }>;
}

export interface AvailableLesson {
  slug: string;
  title: string;
  topic: string;
}

/** Resumen numérico de la estructura de precio reciente, calculado aquí. */
function priceStructure(candles: Candle[]) {
  if (candles.length === 0) return null;
  const closes = candles.map((c) => c.c);
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const high = Math.max(...highs);
  const low = Math.min(...lows);

  // Rango medio relativo: referencia de volatilidad para el estudiante.
  const avgRange =
    candles.reduce((a, c) => a + (c.h - c.l) / c.c, 0) / candles.length;

  return {
    velas: candles.length,
    variacionPeriodoPct: Number((((last - first) / first) * 100).toFixed(3)),
    maximoPeriodo: high,
    minimoPeriodo: low,
    posicionEnRangoPct: Number((((last - low) / (high - low || 1)) * 100).toFixed(1)),
    rangoMedioRelativoPct: Number((avgRange * 100).toFixed(3)),
    ultimasCincoVelas: candles.slice(-5).map((c) => ({
      hora: new Date(c.t).toISOString(),
      apertura: c.o,
      maximo: c.h,
      minimo: c.l,
      cierre: c.c,
      volumen: c.v,
    })),
  };
}

export function buildMarketContextBlock(ctx: MarketContext): string {
  const structure = priceStructure(ctx.candles);
  const payload = {
    instrumento: {
      simbolo: ctx.symbol,
      nombre: ctx.assetName,
      clase: ctx.assetClass,
      temporalidad: ctx.timeframe,
    },
    precio: {
      actual: ctx.currentPrice,
      variacionDiariaPct: ctx.changePercent,
      maximoDia: ctx.dayHigh,
      minimoDia: ctx.dayLow,
    },
    estructuraReciente: structure,
    indicadoresCalculadosPorElBackend: ctx.indicators,
    procedenciaDelDato: {
      proveedor: ctx.provenance.providerLabel,
      esSintetico: ctx.provenance.synthetic,
      estadoMercado: ctx.provenance.marketStatus,
      latenciaMs: ctx.provenance.latencyMs,
      marcaTemporalFuente: new Date(ctx.provenance.sourceTimestamp).toISOString(),
    },
    eventosEconomicosProximos: ctx.upcomingEvents,
  };
  return `CONTEXTO\n${JSON.stringify(payload, null, 2)}`;
}

export function buildTradeContextBlock(market: MarketContext, trade: TradeContext): string {
  return `${buildMarketContextBlock(market)}

SIMULACION_DEL_ESTUDIANTE
${JSON.stringify(
  {
    modo: trade.mode,
    direccion: trade.direction,
    precioEntrada: trade.entryPrice,
    precioSalida: trade.exitPrice,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    apalancamientoSimulado: trade.leverage,
    montoVirtualUsd: trade.stakeUsd,
    relacionRiesgoBeneficio: trade.riskReward,
    desenlace: trade.outcome,
    resultadoVirtualUsd: trade.pnlUsd,
    duracionMinutos: trade.durationMinutes,
    confianzaDeclarada: trade.confidence,
    riesgoPercibido: trade.perceivedRisk,
    motivoEscritoPorElEstudiante: trade.studentRationale,
  },
  null,
  2,
)}`;
}

export function buildJournalContextBlock(journal: JournalContext): string {
  return `CONTEXTO\n${JSON.stringify(
    {
      estadisticasAgregadas: {
        simulacionesTotales: journal.totalSimulations,
        porcentajeAciertos: journal.hitRatePercent,
        fiabilidadDeLaMuestra: journal.sampleReliability,
        usoDeStopLossPct: journal.stopLossUsagePercent,
        riesgoMedioPorSimulacionPct: journal.averageRiskPercent,
        relacionRiesgoBeneficioMedia: journal.averageRiskReward,
        simulacionesImpulsivasPct: journal.impulsivePercent,
        apalancamientoMedio: journal.averageLeverage,
        puntuacionDisciplina: journal.disciplineScore,
      },
      erroresDetectadosPorElSistema: journal.repeatedMistakes,
      entradasRecientesDelDiario: journal.recentEntries,
    },
    null,
    2,
  )}`;
}

export function buildLessonCatalogBlock(lessons: AvailableLesson[]): string {
  return `LECCIONES_DISPONIBLES (elige recommendedLesson solo de esta lista, o null)
${lessons.map((l) => `- ${l.slug} | ${l.title} | tema: ${l.topic}`).join('\n')}`;
}

export const KIND_INSTRUCTION: Record<AIAnalysisKind, string> = {
  CHART_REVIEW:
    'Produce un análisis educativo del contexto de mercado entregado. Describe lo observable y plantea ambos escenarios de forma condicional.',
  POST_TRADE:
    'Revisa la simulación cerrada del estudiante. Evalúa el proceso, no el resultado. Señala una única mejora concreta.',
  JOURNAL_REVIEW:
    'Revisa el diario y las estadísticas del estudiante. Identifica como máximo tres patrones de conducta, con la cifra que los respalda.',
  NEWS_EXPLAINER:
    'Explica el contenido educativo entregado en lenguaje sencillo, centrándote en el mecanismo económico.',
  CONCEPT: 'Explica el concepto solicitado con un ejemplo numérico y un error frecuente asociado.',
};
