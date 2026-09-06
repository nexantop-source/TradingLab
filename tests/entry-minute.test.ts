import { describe, it, expect } from 'vitest';
import { entryMinuteSampleTimes } from '../src/lib/entry-minute';

describe('entry-minute protection samples', () => {
  it('excludes price before entry and before the next completed second', () => {
    expect(entryMinuteSampleTimes(10_450, 10_990)).toEqual([]);
    expect(entryMinuteSampleTimes(10_450, 13_900)).toEqual([11_000, 12_000, 13_000]);
  });
  it('never enters the next minute or exceeds sixty samples', () => {
    expect(entryMinuteSampleTimes(0, 600_000)).toHaveLength(60);
    expect(entryMinuteSampleTimes(58_100, 90_000)).toEqual([59_000]);
    expect(entryMinuteSampleTimes(59_999, 90_000)).toEqual([]);
  });
  it('does not inspect future or invalid intervals', () => {
    expect(entryMinuteSampleTimes(20_000, 19_000)).toEqual([]);
    expect(entryMinuteSampleTimes(NaN, 20_000)).toEqual([]);
    expect(entryMinuteSampleTimes(20_000, Infinity)).toEqual([]);
  });
});
