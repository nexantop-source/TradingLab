import type { MarketTick } from './marketPulse';
/** Preserve real exchange highs/lows and first open, not just sampled closes.
 * Synthetic fallback is only for explicitly labeled, isolated demo fixtures. */
export function aggregateCandles(ticks: MarketTick[], seconds = 5, synthetic = false) {
  const bars = new Map<number, { time:number; open:number; high:number; low:number; close:number }>();
  for (const tick of ticks) {
    const c = tick.candle;
    if (!c && !synthetic) continue;
    const time = Math.floor((c?.t ?? tick.time) / (seconds * 1000)) * seconds;
    const open = c?.o ?? tick.price, high = c?.h ?? tick.price, low = c?.l ?? tick.price, close = c?.c ?? tick.price;
    const existing = bars.get(time);
    if (existing) { existing.high = Math.max(existing.high, high); existing.low = Math.min(existing.low, low); existing.close = close; }
    else bars.set(time, { time, open, high, low, close });
  }
  return [...bars.values()];
}
