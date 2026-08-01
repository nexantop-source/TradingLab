import { NextRequest } from 'next/server';
import { handleError, ok, clientIp } from '@/lib/api';
import { enforce, RATE_LIMITS } from '@/lib/rate-limit';
import { getAuth } from '@/lib/auth';
import { marketData, getSymbol } from '@tl/market-data';

/** Cotizaciones de varios instrumentos. `?symbols=EURUSD,BTCUSD` */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth();
    await enforce(`quotes:${auth?.user.id ?? clientIp(req) ?? 'anon'}`, RATE_LIMITS.marketData);

    const raw = req.nextUrl.searchParams.get('symbols') ?? '';
    const symbols = raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 30);

    if (symbols.length === 0) return ok({ quotes: [] });

    const provider = marketData();
    const quotes = await provider.getQuotes(symbols);

    return ok({
      quotes: quotes.map((q) => {
        const meta = getSymbol(q.symbol);
        return {
          ...q,
          name: meta?.name ?? q.symbol,
          assetClass: meta?.assetClass ?? 'FOREX',
          precision: meta?.precision ?? 2,
        };
      }),
    });
  } catch (error) {
    return handleError(error);
  }
}
