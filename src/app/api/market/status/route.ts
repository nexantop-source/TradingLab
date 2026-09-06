import { NextResponse } from 'next/server';
import { marketData } from '@tl/market-data';
import { LIVE_PAIRS } from '@/packages/market-data/binance-provider';
export const dynamic = 'force-dynamic';
// Fixed public health probe, not a price feed or a user/account endpoint.
// Coalesce concurrent requests and cache successes AND failures per instance.
let cached: { until: number; value: Promise<unknown> } | undefined;
export async function GET() {
  if (!cached || cached.until <= Date.now()) {
    const value = (async () => {
      const realOnly = process.env.REQUIRE_REAL_MARKET_DATA === 'true';
      const instruments = await Promise.all(LIVE_PAIRS.map(async symbol => {
        try {
          const q = await marketData().getQuote(symbol);
          return { symbol, available: !q.provenance.synthetic && q.provenance.freshness === 'REALTIME', source: q.provenance.provider, sourceTimestamp: q.provenance.sourceTimestamp };
        } catch { return { symbol, available: false }; }
      }));
      return { realOnly, instruments };
    })();
    cached = { until: Date.now() + 10000, value };
  }
  return NextResponse.json(await cached.value, { headers: { 'Cache-Control': 'public, max-age=10' } });
}
