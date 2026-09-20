import type { MarketDataProvider } from './provider';
import { pulseSecondTimes, type MarketPulse } from '@/components/trading/marketPulse';

/** Read-only observations, using the same provider as simulation settlement. */
export async function buildMarketPulse(provider: MarketDataProvider, symbol: string, now: number, since?: number): Promise<MarketPulse> {
  const serverTime = Math.floor(now / 1000) * 1000;
  // Yahoo publishes snapshots, not one observation per second. Never backfill
  // historical timestamps with the current quote.
  if (provider.id === 'yahoo-chart-v1') {
    const quote = await provider.getQuote(symbol, serverTime);
    const time = quote.provenance.sourceTimestamp;
    return { symbol, serverTime, ticks: Number.isFinite(time) && time <= serverTime
      ? [{ time, price: quote.price }] : [], quote, provenance: quote.provenance, mode: 'DEMO' };
  }
  const ticks = await Promise.all(pulseSecondTimes(serverTime, since).map(async time => {
    const point = await provider.getPriceAt(symbol, time);
    return { time, price: point.price, ...(point.candle ? { candle: point.candle } : {}) };
  }));
  const quote = await provider.getQuote(symbol, serverTime);
  return { symbol, serverTime, ticks, quote, provenance: quote.provenance, mode: 'DEMO' };
}
