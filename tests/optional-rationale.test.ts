import { describe, expect, it } from 'vitest';
import { createSimulationSchema } from '../src/packages/simulation-engine/validation';
const common = { symbol:'BTCUSDT',stakeCents:5000,confidence:'MEDIUM',perceivedRisk:3,timeframe:'1m',acknowledgedSimulation:true };
const modes = [
  { mode:'POSITION',direction:'BULLISH' },
  { mode:'HYPOTHESIS',direction:'BEARISH',durationMinutes:1 },
  { mode:'PORTFOLIO',side:'BUY',portfolioId:'local-fixture' },
];
describe('practice without a written explanation', () => {
  it.each(modes)('accepts omitted, empty and short notes for $mode', mode => {
    for (const rationale of [undefined,'','   ','a']) {
      const result = createSimulationSchema.parse({ ...common,...mode,rationale });
      expect(result.rationale).toBe(rationale?.trim() ?? '');
    }
  });
  it.each(modes)('still requires explicit virtual-money acknowledgement for $mode', mode => {
    expect(createSimulationSchema.safeParse({ ...common,...mode,acknowledgedSimulation:false }).success).toBe(false);
  });
  it('retains the size/type boundary for optional notes', () => {
    for (const rationale of ['a'.repeat(1001),123,{},null]) {
      expect(createSimulationSchema.safeParse({ ...common,...modes[0],rationale }).success).toBe(false);
    }
  });
});
