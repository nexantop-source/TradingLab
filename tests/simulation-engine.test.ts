import { describe, it, expect } from 'vitest';
import {
  openSimulation,
  closeSimulation,
  settleHypothesis,
  checkTriggers,
  riskRewardRatio,
  maxRiskCents,
  unrealizedPnlCents,
  ENGINE_VERSION,
  SimulationError,
} from '@tl/simulation-engine';
import { verifyLedger, applyPost, LedgerError } from '@tl/simulation-engine';
import type { Candle } from '@tl/types';

/**
 * El motor de simulación es la pieza que un auditor querrá verificar primero.
 * Estas pruebas fijan sus garantías: determinismo, imposibilidad de saldo
 * negativo, coherencia de comisiones y criterio conservador en los disparos.
 */

const BASE = {
  mode: 'POSITION' as const,
  direction: 'BULLISH' as const,
  midPrice: 1.085,
  spreadBps: 1.2,
  stakeCents: 10_000, // USD 100 virtuales
  leverage: 1,
  precision: 5,
};

describe('apertura de simulaciones', () => {
  it('aplica el spread en el lado desfavorable según la dirección', () => {
    const long = openSimulation(BASE);
    const short = openSimulation({ ...BASE, direction: 'BEARISH' });

    expect(long.entryPrice).toBeGreaterThan(BASE.midPrice);
    expect(short.entryPrice).toBeLessThan(BASE.midPrice);
  });

  it('es determinística: las mismas entradas producen la misma salida', () => {
    const a = openSimulation(BASE);
    const b = openSimulation(BASE);
    expect(a).toEqual(b);
  });

  it('registra la versión del motor en cada apertura', () => {
    expect(openSimulation(BASE).engineVersion).toBe(ENGINE_VERSION);
  });

  it('la cantidad escala linealmente con el apalancamiento', () => {
    const x1 = openSimulation(BASE);
    const x10 = openSimulation({ ...BASE, leverage: 10 });
    // Los precios de entrada coinciden, así que la cantidad debe ser 10 veces mayor.
    expect(x10.quantity / x1.quantity).toBeCloseTo(10, 6);
  });

  it('rechaza montos y precios no válidos', () => {
    expect(() => openSimulation({ ...BASE, stakeCents: 0 })).toThrow(SimulationError);
    expect(() => openSimulation({ ...BASE, midPrice: 0 })).toThrow(SimulationError);
    expect(() => openSimulation({ ...BASE, leverage: 0 })).toThrow(SimulationError);
  });
});

describe('cierre de simulaciones', () => {
  it('una posición alcista con precio superior produce resultado positivo', () => {
    const opened = openSimulation(BASE);
    const result = closeSimulation({
      ...BASE,
      entryPrice: opened.entryPrice,
      exitMidPrice: 1.095,
      quantity: opened.quantity,
      closeReason: 'MANUAL',
      openFeeCents: opened.feeCents,
    });
    expect(result.pnlCents).toBeGreaterThan(0);
    expect(result.outcome).toBe('CORRECT');
  });

  it('una posición bajista con precio superior produce resultado negativo', () => {
    const opened = openSimulation({ ...BASE, direction: 'BEARISH' });
    const result = closeSimulation({
      ...BASE,
      direction: 'BEARISH',
      entryPrice: opened.entryPrice,
      exitMidPrice: 1.095,
      quantity: opened.quantity,
      closeReason: 'MANUAL',
      openFeeCents: opened.feeCents,
    });
    expect(result.pnlCents).toBeLessThan(0);
    expect(result.outcome).toBe('INCORRECT');
  });

  it('nunca devuelve una liquidación negativa: la pérdida máxima es el margen', () => {
    const opened = openSimulation({ ...BASE, leverage: 100 });
    const result = closeSimulation({
      ...BASE,
      leverage: 100,
      entryPrice: opened.entryPrice,
      // Caída extrema que, sin el tope, produciría una deuda.
      exitMidPrice: 0.5,
      quantity: opened.quantity,
      closeReason: 'MANUAL',
      openFeeCents: opened.feeCents,
    });
    expect(result.settlementCents).toBe(0);
    expect(result.settlementCents).toBeGreaterThanOrEqual(0);
  });

  it('el cierre parcial liquida proporcionalmente', () => {
    const opened = openSimulation(BASE);
    const full = closeSimulation({
      ...BASE,
      entryPrice: opened.entryPrice,
      exitMidPrice: 1.095,
      quantity: opened.quantity,
      closeReason: 'MANUAL',
      openFeeCents: opened.feeCents,
    });
    const half = closeSimulation({
      ...BASE,
      entryPrice: opened.entryPrice,
      exitMidPrice: 1.095,
      quantity: opened.quantity,
      closeReason: 'PARTIAL',
      openFeeCents: opened.feeCents,
      fraction: 0.5,
    });
    expect(half.pnlCents).toBeCloseTo(full.pnlCents / 2, 0);
  });

  it('devuelve una traza de auditoría legible', () => {
    const opened = openSimulation(BASE);
    const result = closeSimulation({
      ...BASE,
      entryPrice: opened.entryPrice,
      exitMidPrice: 1.09,
      quantity: opened.quantity,
      closeReason: 'MANUAL',
      openFeeCents: opened.feeCents,
    });
    expect(result.audit.length).toBeGreaterThan(3);
    expect(result.audit.join('\n')).toContain(`motor=${ENGINE_VERSION}`);
  });
});

describe('modo hipótesis', () => {
  it('acierta cuando el precio se mueve en el sentido declarado', () => {
    const r = settleHypothesis({
      direction: 'BULLISH',
      entryPrice: 100,
      exitPrice: 101,
      stakeCents: 10_000,
      referenceMovePercent: 0.5,
    });
    expect(r.outcome).toBe('CORRECT');
    expect(r.pnlCents).toBeGreaterThan(0);
  });

  it('falla cuando el precio se mueve en contra', () => {
    const r = settleHypothesis({
      direction: 'BEARISH',
      entryPrice: 100,
      exitPrice: 101,
      stakeCents: 10_000,
      referenceMovePercent: 0.5,
    });
    expect(r.outcome).toBe('INCORRECT');
    expect(r.pnlCents).toBeLessThan(0);
  });

  it('acota el resultado: no existe un pago desproporcionado', () => {
    const r = settleHypothesis({
      direction: 'BULLISH',
      entryPrice: 100,
      exitPrice: 500, // movimiento absurdo
      stakeCents: 10_000,
      referenceMovePercent: 0.5,
    });
    // Con el tope del 85 %, el resultado no puede superar 8.500 centavos.
    expect(r.pnlCents).toBeLessThanOrEqual(8_500);
  });

  it('normaliza por volatilidad: el mismo movimiento porcentual vale distinto', () => {
    const calm = settleHypothesis({
      direction: 'BULLISH',
      entryPrice: 100,
      exitPrice: 100.2,
      stakeCents: 10_000,
      referenceMovePercent: 0.1,
    });
    const volatile = settleHypothesis({
      direction: 'BULLISH',
      entryPrice: 100,
      exitPrice: 100.2,
      stakeCents: 10_000,
      referenceMovePercent: 2,
    });
    expect(calm.pnlCents).toBeGreaterThan(volatile.pnlCents);
  });
});

describe('disparo de stop loss y take profit', () => {
  const candle = (o: number, h: number, l: number, c: number): Candle => ({ t: 0, o, h, l, c, v: 1 });

  it('activa el stop loss cuando el mínimo lo alcanza en una posición alcista', () => {
    const r = checkTriggers({
      direction: 'BULLISH',
      stopLoss: 99,
      takeProfit: 105,
      trailingStopDistance: null,
      entryPrice: 100,
      candles: [candle(100, 101, 98.5, 99.5)],
    });
    expect(r.triggered).toBe(true);
    expect(r.reason).toBe('STOP_LOSS');
  });

  it('ante ambigüedad dentro de la misma vela, asume el stop loss (criterio conservador)', () => {
    const r = checkTriggers({
      direction: 'BULLISH',
      stopLoss: 99,
      takeProfit: 105,
      trailingStopDistance: null,
      // La vela toca los dos niveles: no se conoce el orden real.
      candles: [candle(100, 106, 98, 104)],
      entryPrice: 100,
    });
    expect(r.reason).toBe('STOP_LOSS');
  });

  it('activa el take profit cuando solo se alcanza ese nivel', () => {
    const r = checkTriggers({
      direction: 'BULLISH',
      stopLoss: 95,
      takeProfit: 105,
      trailingStopDistance: null,
      entryPrice: 100,
      candles: [candle(100, 106, 99, 105.5)],
    });
    expect(r.reason).toBe('TAKE_PROFIT');
  });

  it('no dispara nada si el precio permanece dentro del rango', () => {
    const r = checkTriggers({
      direction: 'BULLISH',
      stopLoss: 95,
      takeProfit: 105,
      trailingStopDistance: null,
      entryPrice: 100,
      candles: [candle(100, 102, 98, 101)],
    });
    expect(r.triggered).toBe(false);
  });
});

describe('métricas de riesgo', () => {
  it('calcula la relación riesgo-beneficio', () => {
    expect(riskRewardRatio({ direction: 'BULLISH', entryPrice: 100, stopLoss: 98, takeProfit: 106 })).toBe(3);
    expect(riskRewardRatio({ direction: 'BEARISH', entryPrice: 100, stopLoss: 102, takeProfit: 94 })).toBe(3);
  });

  it('devuelve null cuando los niveles no son coherentes', () => {
    expect(riskRewardRatio({ direction: 'BULLISH', entryPrice: 100, stopLoss: 102, takeProfit: 106 })).toBeNull();
  });

  it('el riesgo máximo nunca supera el margen comprometido', () => {
    const risk = maxRiskCents({
      direction: 'BULLISH',
      entryPrice: 100,
      stopLoss: 50,
      quantity: 100,
      stakeCents: 10_000,
    });
    expect(risk).toBeLessThanOrEqual(10_000);
  });

  it('calcula el resultado no realizado según la dirección', () => {
    const long = unrealizedPnlCents({ direction: 'BULLISH', entryPrice: 100, currentPrice: 101, quantity: 10 });
    const short = unrealizedPnlCents({ direction: 'BEARISH', entryPrice: 100, currentPrice: 101, quantity: 10 });
    expect(long).toBe(1000);
    expect(short).toBe(-1000);
  });
});

describe('libro mayor virtual', () => {
  it('impide que el saldo quede en negativo', () => {
    expect(() =>
      applyPost(100, { amountCents: -500, reason: 'SIMULATION_MARGIN_HOLD', reference: null, memo: null }),
    ).toThrow(LedgerError);
  });

  it('verifica la integridad de una secuencia correcta', () => {
    const rows = [
      { amountCents: 1_000_000, balanceAfterCents: 1_000_000, reason: 'ACCOUNT_OPENING' as const, createdAt: new Date() },
      { amountCents: -10_000, balanceAfterCents: 990_000, reason: 'SIMULATION_MARGIN_HOLD' as const, createdAt: new Date() },
      { amountCents: 12_000, balanceAfterCents: 1_002_000, reason: 'SIMULATION_SETTLEMENT' as const, createdAt: new Date() },
    ];
    const check = verifyLedger(rows);
    expect(check.ok).toBe(true);
    expect(check.computedBalanceCents).toBe(1_002_000);
  });

  it('detecta una divergencia y señala dónde empieza', () => {
    const rows = [
      { amountCents: 1_000_000, balanceAfterCents: 1_000_000, reason: 'ACCOUNT_OPENING' as const, createdAt: new Date() },
      { amountCents: -10_000, balanceAfterCents: 999_999, reason: 'SIMULATION_MARGIN_HOLD' as const, createdAt: new Date() },
    ];
    const check = verifyLedger(rows);
    expect(check.ok).toBe(false);
    expect(check.firstDivergenceIndex).toBe(1);
  });
});
