import type { SimulationOutcome } from '@tl/types';

/**
 * Estadísticas educativas.
 *
 * Diseñadas deliberadamente para que la rentabilidad virtual **no** sea el
 * indicador principal. El indicador de cabecera es la disciplina: si un
 * estudiante gana mucho sin stop loss y sin plan, su puntuación baja.
 */

export interface SimulationSample {
  id: string;
  symbol: string;
  assetClass: string;
  mode: string;
  direction: string | null;
  outcome: SimulationOutcome;
  pnlCents: number | null;
  stakeCents: number;
  leverage: number;
  hasStopLoss: boolean;
  hasTakeProfit: boolean;
  riskReward: number | null;
  /** Longitud del motivo escrito. Un motivo vacío indica decisión no razonada. */
  rationaleLength: number;
  openedAt: string;
  closedAt: string | null;
  /** `true` si existe entrada de diario asociada. */
  hasJournalEntry: boolean;
  /** Minutos transcurridos desde la simulación anterior del mismo usuario. */
  minutesSincePrevious: number | null;
  strategyTag: string | null;
}

export interface EducationalStats {
  totalSimulations: number;
  closed: number;
  correct: number;
  incorrect: number;
  neutral: number;
  /** Porcentaje de aciertos. Se muestra siempre junto al tamaño de muestra. */
  hitRatePercent: number;
  /** Fiabilidad estadística del porcentaje de aciertos, dada la muestra. */
  sampleReliability: 'INSUFICIENTE' | 'ORIENTATIVA' | 'RAZONABLE';
  netPnlCents: number;
  /** Resultado medio por simulación, en centavos. */
  averagePnlCents: number;
  /** Factor de beneficio: suma de ganancias / suma de pérdidas. */
  profitFactor: number | null;
  /** Máxima caída del saldo virtual acumulado, en centavos. */
  maxDrawdownCents: number;
  /** Riesgo medio comprometido por simulación, en porcentaje del saldo inicial. */
  averageRiskPercent: number;
  stopLossUsagePercent: number;
  takeProfitUsagePercent: number;
  averageRiskReward: number | null;
  journalCoveragePercent: number;
  /** Simulaciones abiertas con menos de 3 minutos de diferencia. */
  impulsiveCount: number;
  impulsivePercent: number;
  averageLeverage: number;
  /** Puntuación de disciplina de 0 a 100. Indicador principal del producto. */
  disciplineScore: number;
  disciplineBreakdown: Array<{ label: string; points: number; max: number; hint: string }>;
  byAsset: Array<{ symbol: string; count: number; hitRatePercent: number; netPnlCents: number }>;
  byHour: Array<{ hourUtc: number; count: number; hitRatePercent: number; netPnlCents: number }>;
  byStrategy: Array<{ tag: string; count: number; hitRatePercent: number; netPnlCents: number; avgRiskReward: number | null }>;
  repeatedMistakes: string[];
}

const EMPTY: EducationalStats = {
  totalSimulations: 0,
  closed: 0,
  correct: 0,
  incorrect: 0,
  neutral: 0,
  hitRatePercent: 0,
  sampleReliability: 'INSUFICIENTE',
  netPnlCents: 0,
  averagePnlCents: 0,
  profitFactor: null,
  maxDrawdownCents: 0,
  averageRiskPercent: 0,
  stopLossUsagePercent: 0,
  takeProfitUsagePercent: 0,
  averageRiskReward: null,
  journalCoveragePercent: 0,
  impulsiveCount: 0,
  impulsivePercent: 0,
  averageLeverage: 1,
  disciplineScore: 0,
  disciplineBreakdown: [],
  byAsset: [],
  byHour: [],
  byStrategy: [],
  repeatedMistakes: [],
};

export function computeStats(samples: SimulationSample[], initialBalanceCents: number): EducationalStats {
  if (samples.length === 0) return { ...EMPTY };

  const closed = samples.filter((s) => s.closedAt != null && s.pnlCents != null);
  const correct = closed.filter((s) => s.outcome === 'CORRECT').length;
  const incorrect = closed.filter((s) => s.outcome === 'INCORRECT').length;
  const neutral = closed.filter((s) => s.outcome === 'NEUTRAL').length;

  const netPnlCents = closed.reduce((a, s) => a + (s.pnlCents ?? 0), 0);
  const gains = closed.filter((s) => (s.pnlCents ?? 0) > 0).reduce((a, s) => a + (s.pnlCents ?? 0), 0);
  const losses = Math.abs(closed.filter((s) => (s.pnlCents ?? 0) < 0).reduce((a, s) => a + (s.pnlCents ?? 0), 0));

  // Curva de saldo acumulado para la máxima caída.
  let peak = 0;
  let running = 0;
  let maxDrawdown = 0;
  const chronological = [...closed].sort((a, b) => (a.closedAt! < b.closedAt! ? -1 : 1));
  for (const s of chronological) {
    running += s.pnlCents ?? 0;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const withSL = samples.filter((s) => s.hasStopLoss).length;
  const withTP = samples.filter((s) => s.hasTakeProfit).length;
  const rrValues = samples.map((s) => s.riskReward).filter((v): v is number => v != null && v > 0);
  const journaled = samples.filter((s) => s.hasJournalEntry).length;
  const impulsive = samples.filter((s) => s.minutesSincePrevious != null && s.minutesSincePrevious < 3).length;

  const avgRiskPercent =
    (samples.reduce((a, s) => a + s.stakeCents, 0) / samples.length / initialBalanceCents) * 100;
  const avgLeverage = samples.reduce((a, s) => a + s.leverage, 0) / samples.length;

  const hitRate = closed.length ? (correct / closed.length) * 100 : 0;
  const reliability: EducationalStats['sampleReliability'] =
    closed.length < 20 ? 'INSUFICIENTE' : closed.length < 60 ? 'ORIENTATIVA' : 'RAZONABLE';

  // ── Puntuación de disciplina ────────────────────────────────────────────
  // Cinco dimensiones, ninguna de ellas es «cuánto ganaste».
  const slPct = (withSL / samples.length) * 100;
  const rrAvg = rrValues.length ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : null;
  const journalPct = (journaled / samples.length) * 100;
  const impulsivePct = (impulsive / samples.length) * 100;
  const rationaleQuality =
    samples.reduce((a, s) => a + Math.min(s.rationaleLength, 200), 0) / samples.length / 200;

  const breakdown = [
    {
      label: 'Uso de stop loss',
      points: Math.round((slPct / 100) * 25),
      max: 25,
      hint: 'Definir de antemano dónde admites que tu hipótesis falló.',
    },
    {
      label: 'Relación riesgo-beneficio',
      points: rrAvg == null ? 0 : Math.round(Math.min(rrAvg / 2, 1) * 20),
      max: 20,
      hint: 'Buscar operaciones donde el recorrido esperado supera al riesgo asumido.',
    },
    {
      label: 'Riesgo por operación contenido',
      points: Math.round(Math.max(0, 1 - Math.max(0, avgRiskPercent - 2) / 8) * 20),
      max: 20,
      hint: 'Comprometer un porcentaje pequeño del saldo en cada simulación.',
    },
    {
      label: 'Registro en el diario',
      points: Math.round((journalPct / 100) * 20),
      max: 20,
      hint: 'Documentar la decisión permite revisarla después con criterio.',
    },
    {
      label: 'Ausencia de operaciones impulsivas',
      points: Math.round(Math.max(0, 1 - impulsivePct / 40) * 10),
      max: 10,
      hint: 'Evitar abrir simulaciones encadenadas sin analizar.',
    },
    {
      label: 'Calidad del razonamiento escrito',
      points: Math.round(rationaleQuality * 5),
      max: 5,
      hint: 'Explicar la hipótesis con detalle suficiente para poder evaluarla.',
    },
  ];
  const disciplineScore = Math.min(100, breakdown.reduce((a, b) => a + b.points, 0));

  // ── Agrupaciones ────────────────────────────────────────────────────────
  const byAsset = groupBy(closed, (s) => s.symbol).map(([symbol, rows]) => ({
    symbol,
    count: rows.length,
    hitRatePercent: pct(rows.filter((r) => r.outcome === 'CORRECT').length, rows.length),
    netPnlCents: rows.reduce((a, r) => a + (r.pnlCents ?? 0), 0),
  }));

  const byHour = groupBy(closed, (s) => String(new Date(s.openedAt).getUTCHours())).map(([h, rows]) => ({
    hourUtc: Number(h),
    count: rows.length,
    hitRatePercent: pct(rows.filter((r) => r.outcome === 'CORRECT').length, rows.length),
    netPnlCents: rows.reduce((a, r) => a + (r.pnlCents ?? 0), 0),
  }));

  const byStrategy = groupBy(
    closed.filter((s) => s.strategyTag),
    (s) => s.strategyTag!,
  ).map(([tag, rows]) => {
    const rr = rows.map((r) => r.riskReward).filter((v): v is number => v != null);
    return {
      tag,
      count: rows.length,
      hitRatePercent: pct(rows.filter((r) => r.outcome === 'CORRECT').length, rows.length),
      netPnlCents: rows.reduce((a, r) => a + (r.pnlCents ?? 0), 0),
      avgRiskReward: rr.length ? Number((rr.reduce((a, b) => a + b, 0) / rr.length).toFixed(2)) : null,
    };
  });

  // ── Errores repetidos ───────────────────────────────────────────────────
  const mistakes: string[] = [];
  if (slPct < 60 && samples.length >= 5) {
    mistakes.push(`Solo el ${slPct.toFixed(0)} % de tus simulaciones tiene stop loss definido.`);
  }
  if (avgRiskPercent > 5) {
    mistakes.push(`Comprometes en promedio el ${avgRiskPercent.toFixed(1)} % del saldo por simulación. Es un porcentaje alto.`);
  }
  if (impulsivePct > 20) {
    mistakes.push(`El ${impulsivePct.toFixed(0)} % de tus simulaciones se abrió menos de 3 minutos después de la anterior.`);
  }
  if (rrAvg != null && rrAvg < 1) {
    mistakes.push(`Tu relación riesgo-beneficio media es ${rrAvg.toFixed(2)}: arriesgas más de lo que buscas ganar.`);
  }
  if (journalPct < 40 && samples.length >= 5) {
    mistakes.push(`Solo has documentado en el diario el ${journalPct.toFixed(0)} % de tus simulaciones.`);
  }
  if (avgLeverage > 20) {
    mistakes.push(`Tu apalancamiento simulado medio es ${avgLeverage.toFixed(0)}:1. Revisa la lección sobre apalancamiento.`);
  }

  return {
    totalSimulations: samples.length,
    closed: closed.length,
    correct,
    incorrect,
    neutral,
    hitRatePercent: Number(hitRate.toFixed(1)),
    sampleReliability: reliability,
    netPnlCents,
    averagePnlCents: closed.length ? Math.round(netPnlCents / closed.length) : 0,
    profitFactor: losses > 0 ? Number((gains / losses).toFixed(2)) : gains > 0 ? null : 0,
    maxDrawdownCents: maxDrawdown,
    averageRiskPercent: Number(avgRiskPercent.toFixed(2)),
    stopLossUsagePercent: Number(slPct.toFixed(1)),
    takeProfitUsagePercent: Number(((withTP / samples.length) * 100).toFixed(1)),
    averageRiskReward: rrAvg == null ? null : Number(rrAvg.toFixed(2)),
    journalCoveragePercent: Number(journalPct.toFixed(1)),
    impulsiveCount: impulsive,
    impulsivePercent: Number(impulsivePct.toFixed(1)),
    averageLeverage: Number(avgLeverage.toFixed(1)),
    disciplineScore,
    disciplineBreakdown: breakdown,
    byAsset: byAsset.sort((a, b) => b.count - a.count),
    byHour: byHour.sort((a, b) => a.hourUtc - b.hourUtc),
    byStrategy: byStrategy.sort((a, b) => b.count - a.count),
    repeatedMistakes: mistakes,
  };
}

function groupBy<T>(rows: T[], key: (r: T) => string): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  return Array.from(map.entries());
}

function pct(n: number, d: number): number {
  return d ? Number(((n / d) * 100).toFixed(1)) : 0;
}

export const RELIABILITY_NOTE: Record<EducationalStats['sampleReliability'], string> = {
  INSUFICIENTE:
    'Con menos de 20 simulaciones cerradas, este porcentaje es ruido estadístico. No saques conclusiones todavía.',
  ORIENTATIVA:
    'La muestra empieza a ser orientativa, pero sigue siendo pequeña. Trátala como una tendencia, no como un dato firme.',
  RAZONABLE:
    'La muestra es razonable para detectar patrones. Aun así, el mercado cambia: revísala periódicamente.',
};
