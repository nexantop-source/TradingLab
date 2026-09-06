import type { MarketDataProvider } from './provider';
import { pulseSecondTimes, type MarketPulse } from '@/components/trading/marketPulse';

/** Read-only observations, using the same provider as simulation settlement. */
export async function buildMarketPulse(provider: MarketDataProvider, symbol: string, now: number, since?: number): Promise<MarketPulse> {
  const serverTime = Math.floor(now / 1000) * 1000;
  const ticks = await Promise.all(pulseSecondTimes(serverTime, since).map(async time => ({
    time,
    price: (await provider.getPriceAt(symbol, time)).price,
  })));
  const quote = await provider.getQuote(symbol, serverTime);
  return { symbol, serverTime, ticks, quote, provenance: quote.provenance, mode: 'DEMO' };
}
