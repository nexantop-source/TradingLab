import { z } from 'zod';
import { DIRECTIONS, CONFIDENCE_LEVELS, ORDER_TYPES, SIMULATION_MODES, TIMEFRAMES } from '@tl/types';

/** Duraciones permitidas en el modo hipótesis, en minutos. */
export const HYPOTHESIS_DURATIONS = [1, 5, 15, 30, 60, 240, 1440] as const;

export const HYPOTHESIS_DURATION_LABEL: Record<number, string> = {
  1: '1 minuto',
  5: '5 minutos',
  15: '15 minutos',
  30: '30 minutos',
  60: '1 hora',
  240: '4 horas',
  1440: '1 día',
};

/** Monto virtual mínimo y máximo por simulación, en centavos. */
export const MIN_STAKE_CENTS = 100; // USD 1,00 virtual
export const MAX_STAKE_CENTS = 100_000_00; // USD 100.000 virtuales

export const LEVERAGE_OPTIONS = [1, 2, 5, 10, 20, 50, 100] as const;

const stake = z
  .number()
  .int('El monto virtual debe expresarse en centavos enteros.')
  .min(MIN_STAKE_CENTS, 'El monto virtual mínimo es USD 1,00.')
  .max(MAX_STAKE_CENTS, 'El monto virtual máximo por simulación es USD 100.000.');

const rationale = z
  .string()
  .trim()
  .min(15, 'Explica en al menos 15 caracteres por qué formulas esta hipótesis. Es parte del ejercicio.')
  .max(1000, 'El motivo no puede superar los 1000 caracteres.');

export const createHypothesisSchema = z.object({
  mode: z.literal('HYPOTHESIS'),
  symbol: z.string().min(1).max(20),
  direction: z.enum(DIRECTIONS),
  stakeCents: stake,
  durationMinutes: z.union([
    z.literal(1), z.literal(5), z.literal(15), z.literal(30),
    z.literal(60), z.literal(240), z.literal(1440),
  ]),
  rationale,
  confidence: z.enum(CONFIDENCE_LEVELS),
  perceivedRisk: z.number().int().min(1).max(5),
  timeframe: z.enum(TIMEFRAMES),
  visibleIndicators: z.array(z.string()).max(12).default([]),
  chartType: z.string().default('candles'),
  /** Confirmación explícita de que el usuario entiende que es una simulación. */
  acknowledgedSimulation: z.literal(true, {
    errorMap: () => ({ message: 'Debes confirmar que entiendes que se trata de una simulación educativa.' }),
  }),
});

export const createPositionSchema = z.object({
  mode: z.literal('POSITION'),
  durationMinutes: z.union([z.literal(1),z.literal(2),z.literal(5),z.literal(15),z.literal(60)]).nullable().optional(),
  symbol: z.string().min(1).max(20),
  direction: z.enum(DIRECTIONS),
  orderType: z.enum(ORDER_TYPES).default('MARKET'),
  limitPrice: z.number().positive().nullable().default(null),
  stakeCents: stake,
  leverage: z.union([
    z.literal(1), z.literal(2), z.literal(5), z.literal(10),
    z.literal(20), z.literal(50), z.literal(100),
  ]).default(1),
  stopLoss: z.number().positive().nullable().default(null),
  takeProfit: z.number().positive().nullable().default(null),
  trailingStopDistance: z.number().positive().nullable().default(null),
  rationale,
  confidence: z.enum(CONFIDENCE_LEVELS),
  perceivedRisk: z.number().int().min(1).max(5),
  timeframe: z.enum(TIMEFRAMES),
  visibleIndicators: z.array(z.string()).max(12).default([]),
  chartType: z.string().default('candles'),
  acknowledgedSimulation: z.literal(true, {
    errorMap: () => ({ message: 'Debes confirmar que entiendes que se trata de una simulación educativa.' }),
  }),
});

export const createPortfolioTradeSchema = z.object({
  mode: z.literal('PORTFOLIO'),
  portfolioId: z.string().min(1),
  symbol: z.string().min(1).max(20),
  side: z.enum(['BUY', 'SELL']),
  stakeCents: stake,
  rationale,
  confidence: z.enum(CONFIDENCE_LEVELS),
  perceivedRisk: z.number().int().min(1).max(5),
  timeframe: z.enum(TIMEFRAMES).default('1d'),
  visibleIndicators: z.array(z.string()).max(12).default([]),
  chartType: z.string().default('candles'),
  acknowledgedSimulation: z.literal(true, {
    errorMap: () => ({ message: 'Debes confirmar que entiendes que se trata de una simulación educativa.' }),
  }),
});

export const createSimulationSchema = z.discriminatedUnion('mode', [
  createHypothesisSchema,
  createPositionSchema,
  createPortfolioTradeSchema,
]);

export type CreateSimulationInput = z.infer<typeof createSimulationSchema>;

export const closeSimulationSchema = z.object({
  simulationId: z.string().min(1),
  /** Fracción a cerrar. 1 cierra por completo. */
  fraction: z.number().min(0.01).max(1).default(1),
  note: z.string().max(500).optional(),
});

/**
 * Validación coherente de niveles: el stop loss debe estar del lado correcto
 * del precio, igual que el take profit. Se comprueba en el servidor antes de
 * abrir nada.
 */
export function validateLevels(params: {
  direction: 'BULLISH' | 'BEARISH';
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
}): { ok: true } | { ok: false; message: string } {
  const isLong = params.direction === 'BULLISH';
  if (params.stopLoss != null) {
    if (isLong && params.stopLoss >= params.entryPrice) {
      return { ok: false, message: 'En una posición alcista el stop loss debe situarse por debajo del precio de entrada.' };
    }
    if (!isLong && params.stopLoss <= params.entryPrice) {
      return { ok: false, message: 'En una posición bajista el stop loss debe situarse por encima del precio de entrada.' };
    }
  }
  if (params.takeProfit != null) {
    if (isLong && params.takeProfit <= params.entryPrice) {
      return { ok: false, message: 'En una posición alcista el take profit debe situarse por encima del precio de entrada.' };
    }
    if (!isLong && params.takeProfit >= params.entryPrice) {
      return { ok: false, message: 'En una posición bajista el take profit debe situarse por debajo del precio de entrada.' };
    }
  }
  return { ok: true };
}

export const SIMULATION_MODE_LABEL: Record<(typeof SIMULATION_MODES)[number], string> = {
  HYPOTHESIS: 'Hipótesis direccional',
  POSITION: 'Posición simulada',
  PORTFOLIO: 'Portafolio DEMO',
};
