import { describe, it, expect } from 'vitest';
import { SyntheticMarketDataProvider, candleAt, getSymbol, lastOpenTimestamp, marketStatusFor, priceAt, roundToTick } from '@tl/market-data';
import { buildMarketPulse } from '@/packages/market-data/pulse';
import { interpolateEndpoint, mergeMarketTicks, pulseSecondTimes } from '@/components/trading/marketPulse';

const provider = new SyntheticMarketDataProvider();
const now = Date.UTC(2026, 8, 7, 16, 20, 37, 428);

describe('bounded read-only market pulse', () => {
  it('returns two minutes of completed timestamps plus the aligned current second', () => {
    const times = pulseSecondTimes(now);
    expect(times).toHaveLength(121);
    expect(times[0]).toBe(Math.floor(now / 1000) * 1000 - 120_000);
    expect(times.at(-1)).toBe(Math.floor(now / 1000) * 1000);
    expect(times.every(time => time <= now && time % 1000 === 0)).toBe(true);
  });
  it('returns deltas without duplicates and clamps old cursors', () => {
    expect(pulseSecondTimes(now, Math.floor(now / 1000) * 1000 - 2000)).toHaveLength(2);
    expect(pulseSecondTimes(now, Math.floor(now / 1000) * 1000)).toEqual([]);
    expect(pulseSecondTimes(now, 0)).toHaveLength(120);
  });
  it('keeps chart, quote and settlement provider identical at the same instant', async () => {
    const result = await buildMarketPulse(provider, 'BTCUSD', now);
    expect(result.mode).toBe('DEMO');
    expect(result.provenance.synthetic).toBe(true);
    expect(result.ticks.at(-1)?.price).toBe(result.quote.price);
    expect(result.serverTime).toBe(result.provenance.sourceTimestamp);
    for (const tick of result.ticks) expect(tick.price).toBe((await provider.getPriceAt('BTCUSD', tick.time)).price);
  });
  it('merges only valid received seconds, deduplicates and bounds history', () => {
    const time = Math.floor(now / 1000) * 1000;
    const merged = mergeMarketTicks(
      [{ time: time - 500_000, price: 90 }, { time: time - 1000, price: 100 }],
      [{ time, price: 101 }, { time: time - 1000, price: 100.5 }, { time: time + 1000, price: 999 }, { time: time - 500, price: 90 }, { time: time - 2000, price: NaN }, { time: time - 3000, price: -5 }], time,
    );
    expect(merged).toEqual([{ time: time - 1000, price: 100.5 }, { time, price: 101 }]);
  });
  it('animates only between a prior price and the received endpoint without overshoot', () => {
    const ticks = [{ time: 1000, price: 10 }, { time: 2000, price: 20 }];
    expect(interpolateEndpoint(ticks, 10, .5)).toEqual([{ time: 1000, price: 10 }, { time: 2000, price: 15 }]);
    expect(interpolateEndpoint(ticks, 10, 2)).toEqual(ticks);
    expect(interpolateEndpoint(ticks, 10, -1).at(-1)?.price).toBe(10);
    expect(interpolateEndpoint(ticks, 10, .5).map(tick => tick.time)).toEqual(ticks.map(tick => tick.time));
  });
});

describe('forming candles never expose future observations', () => {
  const meta = getSymbol('BTCUSD')!;
  const open = Date.UTC(2026, 8, 7, 16, 20);
  it('uses elapsed time for open/high/low/close and preserves completed candles', () => {
    const partial = candleAt(meta, open, 60_000, 17_000);
    expect(partial.c).toBe(priceAt(meta, open + 17_000));
    const observed = Array.from({ length: 13 }, (_, i) => priceAt(meta, open + 17_000 * i / 12));
    expect(partial.h).toBe(Math.max(...observed));
    expect(partial.l).toBe(Math.min(...observed));
    expect(candleAt(meta, open, 60_000)).toEqual(candleAt(meta, open, 60_000, 60_000));
    expect(candleAt(meta, open, 60_000, 120_000)).toEqual(candleAt(meta, open, 60_000));
  });
  it('represents a just-opened candle without future movement or volume', () => {
    const candle = candleAt(meta, open, 60_000, 0);
    expect(candle).toEqual({ o: priceAt(meta, open), h: priceAt(meta, open), l: priceAt(meta, open), c: priceAt(meta, open), v: 0 });
  });
  it('provider current candle closes at the requested time and retains prior history', async () => {
    const early = await provider.getCandles({ symbol: meta.symbol, timeframe: '1m', limit: 3, to: open + 17_000 });
    const later = await provider.getCandles({ symbol: meta.symbol, timeframe: '1m', limit: 3, to: open + 38_000 });
    expect(early.candles.at(-1)?.c).toBe((await provider.getPriceAt(meta.symbol, open + 17_000)).price);
    expect(early.candles.slice(0, -1)).toEqual(later.candles.slice(0, -1));
    const completed = candleAt(meta, open - 60_000, 60_000);
    expect(early.candles.at(-2)).toEqual({ t: open - 60_000, ...Object.fromEntries(['o', 'h', 'l', 'c'].map(key => [key, roundToTick(completed[key as 'o'], meta.tickSize, meta.precision)])), v: completed.v });
  });
  it('daily range at UTC midnight does not inspect the next minute', async () => {
    const quote = await provider.getQuote('BTCUSD', Date.UTC(2026, 8, 7));
    expect(quote.dayHigh).toBe(quote.price);
    expect(quote.dayLow).toBe(quote.price);
    expect(quote.volume).toBe(0);
  });
});

describe('closed market uses a stable calendar boundary', () => {
  const session = getSymbol('AAPL')!.session;
  const fridayClose = Date.UTC(2026, 8, 4, 20) - 1;
  it('freezes all weekend requests at the same final open millisecond', () => {
    for (const time of [Date.UTC(2026, 8, 4, 20), Date.UTC(2026, 8, 5, 3, 16, 11), Date.UTC(2026, 8, 6, 22, 9, 35)]) {
      expect(lastOpenTimestamp(session, time)).toBe(fridayClose);
      expect(marketStatusFor(session, lastOpenTimestamp(session, time))).toBe('OPEN');
    }
  });
  it('keeps prices and source timestamps stable during pre-open and closed pulses', async () => {
    const result = await buildMarketPulse(provider, 'AAPL', Date.UTC(2026, 8, 7, 13, 15));
    expect(new Set(result.ticks.map(tick => tick.price)).size).toBe(1);
    expect(result.quote.price).toBe(result.ticks[0].price);
    expect(result.provenance.sourceTimestamp).toBe(fridayClose);
    expect(result.provenance.marketStatus).toBe('PRE_OPEN');
    expect(result.provenance.freshness).toBe('MARKET_CLOSED');
  });
  it('handles sessions closing at midnight without relative-step drift', () => {
    const forex = getSymbol('EURUSD')!.session;
    expect(lastOpenTimestamp(forex, Date.UTC(2026, 8, 6, 19, 47, 11))).toBe(Date.UTC(2026, 8, 5) - 1);
  });
});
