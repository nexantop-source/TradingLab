import type {
  Candle,
  CloseReason,
  Direction,
  SimulationMode,
  SimulationOutcome,
} from '@tl/types';
import { SIMULATION_ENGINE_VERSION } from '@tl/types';

/**
 * Motor de simulación.
 *
 * Propiedades exigidas por los criterios de aceptación:
 *  - Determinístico: mismas entradas ⇒ mismas salidas. Sin `Date.now()`, sin
 *    aleatoriedad. Todos los instantes se reciben como parámetro.
 *  - Auditable: cada resultado se acompaña de la traza de cálculo.
 *  - Inmutable frente a la IA: este módulo no importa nada de `@tl/ai`. La IA
 *    no puede alterar precios de entrada, salida ni resultados.
 */

export const ENGINE_VERSION = SIMULATION_ENGINE_VERSION;

// ─────────────────────────────────────────────────────────────────────────────
// Apertura
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenParams {
  mode: SimulationMode;
  direction: Direction | null;
  /** Precio medio en el momento de la apertura. */
  midPrice: number;
  /** Spread virtual del instrumento, en puntos básicos. */
  spreadBps: number;
  /** Monto virtual comprometido, en centavos. */
  stakeCents: number;
  leverage: number;
  /** Decimales de precio del instrumento. */
  precision: number;
}

export interface OpenResult {
  /** Precio efectivo de entrada, ya con el spread virtual aplicado. */
  entryPrice: number;
  /** Unidades del activo que representa la posición. */
  quantity: number;
  /** Comisión/spread virtual cobrado al abrir, en centavos. */
  feeCents: number;
  /** Centavos retenidos como margen virtual. */
  marginHoldCents: number;
  engineVersion: string;
}

/**
 * El coste del spread se cobra explícitamente como comisión, y además el
 * precio de entrada se sitúa en el lado desfavorable. Así el estudiante ve las
 * dos formas en que un coste de transacción aparece en la práctica.
 */
export function openSimulation(p: OpenParams): OpenResult {
  assertPositive(p.midPrice, 'midPrice');
  assertPositive(p.stakeCents, 'stakeCents');
  if (p.leverage < 1) throw new SimulationError('El apalancamiento simulado mínimo es 1.', 'INVALID_INPUT');

  const halfSpread = (p.midPrice * p.spreadBps) / 10000 / 2;
  const isLong = p.direction !== 'BEARISH';
  const entryPrice = round(isLong ? p.midPrice + halfSpread : p.midPrice - halfSpread, p.precision);

  // Nocional = margen × apalancamiento. En modo hipótesis el apalancamiento es 1.
  const notionalCents = p.stakeCents * p.leverage;
  const quantity = notionalCents / 100 / entryPrice;

  // Comisión virtual: medio spread sobre el nocional, redondeado a centavo.
  const feeCents = Math.round((notionalCents * p.spreadBps) / 10000 / 2);

  return {
    entryPrice,
    quantity: Number(quantity.toFixed(10)),
    feeCents,
    marginHoldCents: p.stakeCents,
    engineVersion: ENGINE_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cierre
// ─────────────────────────────────────────────────────────────────────────────

export interface CloseParams {
  mode: SimulationMode;
  direction: Direction | null;
  entryPrice: number;
  /** Precio medio en el instante de cierre. */
  exitMidPrice: number;
  spreadBps: number;
  quantity: number;
  stakeCents: number;
  leverage: number;
  precision: number;
  closeReason: CloseReason;
  /** Comisión ya cobrada en la apertura, en centavos. */
  openFeeCents: number;
  /** Fracción cerrada, entre 0 y 1. Permite cierres parciales. */
  fraction?: number;
}

export interface CloseResult {
  exitPrice: number;
  /** Resultado neto de la parte cerrada, en centavos. Ya descuenta comisiones. */
  pnlCents: number;
  /** Comisión de cierre, en centavos. */
  closeFeeCents: number;
  /** Centavos a devolver al saldo: margen liberado + resultado. */
  settlementCents: number;
  outcome: SimulationOutcome;
  /** Rendimiento sobre el margen comprometido, en porcentaje. */
  returnOnMarginPercent: number;
  closeReason: CloseReason;
  engineVersion: string;
  /** Traza legible del cálculo, se guarda para auditoría. */
  audit: string[];
}

export function closeSimulation(p: CloseParams): CloseResult {
  assertPositive(p.exitMidPrice, 'exitMidPrice');
  const fraction = clamp(p.fraction ?? 1, 0.0001, 1);
  const isLong = p.direction !== 'BEARISH';

  // Al cerrar se cruza el spread en sentido contrario al de la apertura.
  const halfSpread = (p.exitMidPrice * p.spreadBps) / 10000 / 2;
  const exitPrice = round(isLong ? p.exitMidPrice - halfSpread : p.exitMidPrice + halfSpread, p.precision);

  const closedQty = p.quantity * fraction;
  const priceDelta = isLong ? exitPrice - p.entryPrice : p.entryPrice - exitPrice;
  const grossCents = Math.round(priceDelta * closedQty * 100);

  const notionalCents = p.stakeCents * p.leverage * fraction;
  const closeFeeCents = Math.round((notionalCents * p.spreadBps) / 10000 / 2);

  const openFeeShare = Math.round(p.openFeeCents * fraction);
  const netCents = grossCents - closeFeeCents;

  const marginShare = Math.round(p.stakeCents * fraction);
  // El margen liberado más el resultado. Nunca puede devolver menos de 0:
  // en simulación, la pérdida máxima es el margen comprometido (no hay saldo
  // negativo ni llamadas de margen que endeuden al estudiante).
  const settlementCents = Math.max(0, marginShare + netCents);

  const outcome: SimulationOutcome = netCents > 0 ? 'CORRECT' : netCents < 0 ? 'INCORRECT' : 'NEUTRAL';
  const returnOnMarginPercent = marginShare > 0 ? Number(((netCents / marginShare) * 100).toFixed(2)) : 0;

  const audit = [
    `motor=${ENGINE_VERSION}`,
    `modo=${p.mode} direccion=${p.direction ?? 'N/A'} fraccion=${fraction}`,
    `entrada=${p.entryPrice} salidaMedia=${p.exitMidPrice} medioSpread=${halfSpread.toFixed(p.precision + 2)} salidaEfectiva=${exitPrice}`,
    `cantidad=${closedQty} deltaPrecio=${priceDelta}`,
    `brutoCentavos=${grossCents} comisionApertura=${openFeeShare} comisionCierre=${closeFeeCents} netoCentavos=${netCents}`,
    `margenLiberado=${marginShare} liquidacion=${settlementCents} motivoCierre=${p.closeReason}`,
  ];

  return {
    exitPrice,
    pnlCents: netCents,
    closeFeeCents,
    settlementCents,
    outcome,
    returnOnMarginPercent,
    closeReason: p.closeReason,
    engineVersion: ENGINE_VERSION,
    audit,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado no realizado
// ─────────────────────────────────────────────────────────────────────────────

export function unrealizedPnlCents(params: {
  direction: Direction | null;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
}): number {
  const isLong = params.direction !== 'BEARISH';
  const delta = isLong ? params.currentPrice - params.entryPrice : params.entryPrice - params.currentPrice;
  return Math.round(delta * params.quantity * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Disparo de stop loss, take profit y trailing stop
// ─────────────────────────────────────────────────────────────────────────────

export interface TriggerCheck {
  direction: Direction | null;
  stopLoss: number | null;
  takeProfit: number | null;
  trailingStopDistance: number | null;
  entryPrice: number;
  /** Velas transcurridas desde la apertura, en orden cronológico. */
  candles: Candle[];
}

export interface TriggerResult {
  triggered: boolean;
  reason: CloseReason | null;
  /** Precio al que se considera disparado. */
  price: number | null;
  /** Instante del disparo. */
  at: number | null;
}

/**
 * Evalúa disparos recorriendo las velas en orden.
 *
 * Criterio conservador y explícito para el estudiante: si dentro de la misma
 * vela se tocan stop loss y take profit, se asume que se ejecutó primero el
 * stop loss. Es la hipótesis prudente y se documenta en la interfaz.
 */
export function checkTriggers(p: TriggerCheck): TriggerResult {
  const isLong = p.direction !== 'BEARISH';
  let trailAnchor = p.entryPrice;

  for (const c of p.candles) {
    // Actualiza el ancla del trailing stop con el extremo favorable de la vela.
    if (p.trailingStopDistance != null) {
      trailAnchor = isLong ? Math.max(trailAnchor, c.h) : Math.min(trailAnchor, c.l);
      const trailLevel = isLong
        ? trailAnchor - p.trailingStopDistance
        : trailAnchor + p.trailingStopDistance;
      const trailHit = isLong ? c.l <= trailLevel : c.h >= trailLevel;
      const slHit = p.stopLoss != null && (isLong ? c.l <= p.stopLoss : c.h >= p.stopLoss);
      if (trailHit && !slHit) {
        return { triggered: true, reason: 'TRAILING_STOP', price: trailLevel, at: c.t };
      }
    }

    if (p.stopLoss != null) {
      const hit = isLong ? c.l <= p.stopLoss : c.h >= p.stopLoss;
      if (hit) return { triggered: true, reason: 'STOP_LOSS', price: p.stopLoss, at: c.t };
    }
    if (p.takeProfit != null) {
      const hit = isLong ? c.h >= p.takeProfit : c.l <= p.takeProfit;
      if (hit) return { triggered: true, reason: 'TAKE_PROFIT', price: p.takeProfit, at: c.t };
    }
  }

  return { triggered: false, reason: null, price: null, at: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Modo hipótesis
// ─────────────────────────────────────────────────────────────────────────────

/**
 * En el modo hipótesis no hay «pago» ni «premio»: el estudiante declara una
 * dirección y, al vencer el plazo, se comprueba si el precio se movió en ese
 * sentido. El resultado virtual es proporcional al movimiento real, con tope,
 * para que el aprendizaje sea sobre el mercado y no sobre una mecánica de
 * apuesta con pago fijo.
 */
export const HYPOTHESIS_MAX_RETURN_PERCENT = 85;

export function settleHypothesis(params: {
  direction: Direction;
  entryPrice: number;
  exitPrice: number;
  stakeCents: number;
  /** Volatilidad de referencia (ATR relativo) para normalizar el movimiento. */
  referenceMovePercent: number;
}): { pnlCents: number; outcome: SimulationOutcome; movePercent: number; audit: string[] } {
  const rawMove = ((params.exitPrice - params.entryPrice) / params.entryPrice) * 100;
  const signedMove = params.direction === 'BULLISH' ? rawMove : -rawMove;

  // Normaliza el movimiento contra la referencia de volatilidad: un 0,1 % en
  // EUR/USD y un 0,1 % en Bitcoin no significan lo mismo.
  const reference = Math.max(params.referenceMovePercent, 0.02);
  const normalized = signedMove / reference;
  const capped = clamp(normalized, -1, 1);
  const pnlCents = Math.round(params.stakeCents * capped * (HYPOTHESIS_MAX_RETURN_PERCENT / 100));

  const outcome: SimulationOutcome = signedMove > 0 ? 'CORRECT' : signedMove < 0 ? 'INCORRECT' : 'NEUTRAL';

  return {
    pnlCents,
    outcome,
    movePercent: Number(signedMove.toFixed(4)),
    audit: [
      `motor=${ENGINE_VERSION} modo=HYPOTHESIS`,
      `entrada=${params.entryPrice} salida=${params.exitPrice} movimientoBruto=${rawMove.toFixed(4)}%`,
      `direccion=${params.direction} movimientoAFavor=${signedMove.toFixed(4)}%`,
      `referenciaVolatilidad=${reference.toFixed(4)}% normalizado=${normalized.toFixed(4)} acotado=${capped.toFixed(4)}`,
      `resultadoCentavos=${pnlCents} desenlace=${outcome}`,
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────

export class SimulationError extends Error {
  constructor(message: string, readonly code: 'INVALID_INPUT' | 'LIMIT_REACHED' | 'MARKET_CLOSED' | 'NOT_ALLOWED') {
    super(message);
    this.name = 'SimulationError';
  }
}

function assertPositive(v: number, name: string): void {
  if (!Number.isFinite(v) || v <= 0) {
    throw new SimulationError(`Valor inválido para ${name}: ${v}`, 'INVALID_INPUT');
  }
}

function round(v: number, precision: number): number {
  return Number(v.toFixed(precision));
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/** Relación riesgo-beneficio de una posición planificada. */
export function riskRewardRatio(params: {
  direction: Direction;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
}): number | null {
  if (params.stopLoss == null || params.takeProfit == null) return null;
  const isLong = params.direction === 'BULLISH';
  const risk = isLong ? params.entryPrice - params.stopLoss : params.stopLoss - params.entryPrice;
  const reward = isLong ? params.takeProfit - params.entryPrice : params.entryPrice - params.takeProfit;
  if (risk <= 0 || reward <= 0) return null;
  return Number((reward / risk).toFixed(2));
}

/** Riesgo máximo virtual de una posición con stop loss, en centavos. */
export function maxRiskCents(params: {
  direction: Direction;
  entryPrice: number;
  stopLoss: number | null;
  quantity: number;
  stakeCents: number;
}): number {
  if (params.stopLoss == null) return params.stakeCents;
  const isLong = params.direction === 'BULLISH';
  const distance = isLong ? params.entryPrice - params.stopLoss : params.stopLoss - params.entryPrice;
  if (distance <= 0) return params.stakeCents;
  return Math.min(params.stakeCents, Math.round(distance * params.quantity * 100));
}
