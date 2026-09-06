import { describe, expect, it } from 'vitest';
import { aggregateCandles } from '../src/components/trading/aggregateCandles';
import { mergeMarketTicks } from '../src/components/trading/marketPulse';
describe('Japanese candlesticks preserve real OHLC', () => {
  const ticks = [
    { time:1000,price:102,candle:{t:0,o:100,h:109,l:98,c:102,v:4} },
    { time:2000,price:101,candle:{t:1000,o:102,h:105,l:95,c:101,v:3} },
    { time:6000,price:99,candle:{t:5000,o:101,h:104,l:96,c:99,v:2} },
  ];
  it('retains wicks not present in sampled closing prices', () => {
    expect(aggregateCandles(ticks)).toEqual([
      { time:0,open:100,high:109,low:95,close:101 },
      { time:5,open:101,high:104,low:96,close:99 },
    ]);
  });
  it('never fabricates OHLC for real ticks lacking candle data', () => {
    expect(aggregateCandles([{time:1000,price:100}])).toEqual([]);
  });
  it('passes verified OHLC through the client merge', () => {
    expect(mergeMarketTicks([],ticks,6000)).toEqual(ticks);
  });
  it('rejects malformed or future OHLC data', () => {
    expect(mergeMarketTicks([],ticks.map(t=>({...t,candle:{...t.candle,h:1}})),6000)).toEqual([]);
    expect(mergeMarketTicks([],ticks.map(t=>({...t,candle:{...t.candle,t:99999}})),6000)).toEqual([]);
  });
});
