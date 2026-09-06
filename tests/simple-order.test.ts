import { describe, expect, it } from 'vitest';
import { estimateSimpleOrder, parseDemoAmount } from '../src/lib/simple-order';
const base = { direction: 'BULLISH' as const, amount: '50', balanceCents: 1000000, quote: { bid: 99, ask: 101 }, spreadBps: 8, precision: 2, stopPercent: '1', profitPercent: '2' };
describe('simple demo order review', () => {
  it.each(['', '0', '-10', '1e3', 'Infinity', 'NaN', '1.123', '100000.01', '2,1,0'])('rejects invalid amounts: %s', value => { expect(parseDemoAmount(value)).toBeNull(); });
  it('accepts exact iPhone decimal amounts', () => { expect(parseDemoAmount('10,25')).toBe(1025); expect(parseDemoAmount('1.01')).toBe(101); expect(parseDemoAmount('100000')).toBe(10000000); });
  it('uses the chosen direction, not previous React state', () => {
    expect(estimateSimpleOrder(base)).toMatchObject({ entryPrice: 101, stopLoss: 99.99, takeProfit: 103.02 });
    expect(estimateSimpleOrder({ ...base, direction: 'BEARISH' })).toMatchObject({ entryPrice: 99, stopLoss: 99.99, takeProfit: 97.02 });
  });
  it('includes the virtual fee in affordability', () => { expect(() => estimateSimpleOrder({ ...base, balanceCents: 5000 })).toThrow(/comisión/); });
  it('allows explicitly unset risk levels', () => { expect(estimateSimpleOrder({ ...base, stopPercent: '', profitPercent: '' })).toMatchObject({ stopLoss: null, takeProfit: null }); });
  it.each(['-1', '0', '100', 'NaN', '1e2'])('rejects invalid risk distance: %s', stopPercent => { expect(() => estimateSimpleOrder({ ...base, stopPercent })).toThrow(); });
  it('rejects prices too coarse for the requested level', () => { expect(() => estimateSimpleOrder({ ...base, stopPercent: '0.01', precision: 0 })).toThrow(); });
  it('rejects a nonfinite quote', () => { expect(() => estimateSimpleOrder({ ...base, quote: { ask: NaN, bid: 99 } })).toThrow(/cotización/); });
});
