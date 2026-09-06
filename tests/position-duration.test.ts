import { describe, expect, it } from 'vitest';
import { createPositionSchema } from '../src/packages/simulation-engine/validation';
const input = { mode: 'POSITION', symbol: 'BTCUSDT', direction: 'BULLISH', stakeCents: 5000,
  rationale: 'Hipótesis educativa para una práctica con tiempo.', confidence: 'MEDIUM',
  perceivedRisk: 3, timeframe: '1m', acknowledgedSimulation: true };
describe('position duration input contract', () => {
  it.each([undefined, null, 1, 2, 5, 15, 60])('allows explicit supported duration %s', durationMinutes => {
    expect(createPositionSchema.safeParse({ ...input, durationMinutes }).success).toBe(true);
  });
  it.each([0, -1, 3, 0.5, 120, '1', Infinity])('rejects unsupported duration %s', durationMinutes => {
    expect(createPositionSchema.safeParse({ ...input, durationMinutes }).success).toBe(false);
  });
});
