import { MAX_STAKE_CENTS, MIN_STAKE_CENTS, validateLevels } from '@tl/simulation-engine';

export type SimpleDirection = 'BULLISH' | 'BEARISH';
export interface SimpleOrderEstimate { direction: SimpleDirection; stakeCents: number; entryPrice: number; feeCents: number; stopLoss: number | null; takeProfit: number | null }

/** Accept both iPhone decimal separators, never floats/exponents/rounded hidden cents. */
export function parseDemoAmount(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents >= MIN_STAKE_CENTS && cents <= MAX_STAKE_CENTS ? cents : null;
}

function distance(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) throw new Error('Escribe una distancia entre 0,01 % y 95 %.');
  const result = Number(value.replace(',', '.'));
  if (!Number.isFinite(result) || result < .01 || result > 95) throw new Error('Escribe una distancia entre 0,01 % y 95 %.');
  return result;
}

export function estimateSimpleOrder(input: {
  direction: SimpleDirection; amount: string; balanceCents: number; quote: { bid: number; ask: number };
  spreadBps: number; precision: number; stopPercent: string; profitPercent: string;
}): SimpleOrderEstimate {
  const stakeCents = parseDemoAmount(input.amount);
  if (stakeCents === null) throw new Error('Escribe un monto demo entre USD 1 y USD 100.000, con máximo dos decimales.');
  const feeCents = Math.round(stakeCents * input.spreadBps / 20000);
  if (stakeCents + feeCents > input.balanceCents) throw new Error('El monto más la comisión virtual supera tu saldo disponible. Reduce el monto.');
  const entryPrice = input.direction === 'BULLISH' ? input.quote.ask : input.quote.bid;
  if (!(entryPrice > 0) || !Number.isFinite(entryPrice)) throw new Error('Espera una cotización válida antes de continuar.');
  const sign = input.direction === 'BULLISH' ? 1 : -1;
  const sl = distance(input.stopPercent);
  const tp = distance(input.profitPercent);
  const stopLoss = sl === null ? null : Number((entryPrice * (1 - sign * sl / 100)).toFixed(input.precision));
  const takeProfit = tp === null ? null : Number((entryPrice * (1 + sign * tp / 100)).toFixed(input.precision));
  if ((stopLoss !== null && stopLoss <= 0) || (takeProfit !== null && takeProfit <= 0)) throw new Error('Amplía la distancia del nivel para este instrumento.');
  const levels = validateLevels({ direction: input.direction, entryPrice, stopLoss, takeProfit });
  if (!levels.ok) throw new Error('La distancia es menor que un cambio mínimo de precio. Amplíala para este instrumento.');
  return { direction: input.direction, stakeCents, entryPrice, feeCents, stopLoss, takeProfit };
}
