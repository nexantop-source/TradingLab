import type { DataProvenance, Quote } from '@tl/types';

export interface MarketTick { time: number; price: number }
export interface MarketPulse {
  symbol: string;
  serverTime: number;
  ticks: MarketTick[];
  quote: Quote;
  provenance: DataProvenance;
  mode: 'DEMO';
}

export const MAX_PULSE_TICKS = 121;
export const PULSE_STALE_MS = 5_000;

/** One server observation per second, ordered, bounded and never extrapolated. */
export function mergeMarketTicks(current: MarketTick[], incoming: MarketTick[], serverTime: number): MarketTick[] {
  const byTime = new Map<number, MarketTick>();
  const end = Math.floor(serverTime / 1000) * 1000;
  const start = end - (MAX_PULSE_TICKS - 1) * 1000;
  for (const tick of [...current, ...incoming]) {
    if (!Number.isSafeInteger(tick.time) || tick.time % 1000 !== 0 || tick.time < start || tick.time > end) continue;
    if (!Number.isFinite(tick.price) || tick.price <= 0) continue;
    byTime.set(tick.time, tick);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time).slice(-MAX_PULSE_TICKS);
}

export function pulseSecondTimes(now: number, since?: number): number[] {
  const end = Math.floor(now / 1000) * 1000;
  const start = since == null
    ? end - (MAX_PULSE_TICKS - 1) * 1000
    : Math.max(end - (MAX_PULSE_TICKS - 2) * 1000, Math.floor(since / 1000) * 1000 + 1000);
  if (start > end) return [];
  return Array.from({ length: Math.floor((end - start) / 1000) + 1 }, (_, i) => start + i * 1000);
}

/** Interpolate only a newly received endpoint. No fabricated ticks or future prices. */
export function interpolateEndpoint(ticks: MarketTick[], previousPrice: number, progress: number): MarketTick[] {
  if (ticks.length === 0) return ticks;
  const last = ticks[ticks.length - 1];
  const p = Math.max(0, Math.min(progress, 1));
  return [...ticks.slice(0, -1), { ...last, price: previousPrice + (last.price - previousPrice) * p }];
}
