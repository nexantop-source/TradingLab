import { NextRequest } from 'next/server';
import { handleError, ok, fail } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { watchlistSchema } from '@/lib/validation';
import { getSymbol, marketData } from '@tl/market-data';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';

export async function GET() {
  try {
    const { user } = await requireAuth();
    const items = await db.watchlistItem.findMany({
      where: { userId: user.id },
      orderBy: [{ favorite: 'desc' }, { position: 'asc' }],
    });

    const provider = marketData();
    const quotes = await provider.getQuotes(items.map((i) => i.symbol));
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

    return ok({
      items: items.map((i) => {
        const meta = getSymbol(i.symbol);
        const q = bySymbol.get(i.symbol);
        return {
          symbol: i.symbol,
          name: meta?.name ?? i.symbol,
          assetClass: meta?.assetClass ?? 'FOREX',
          precision: meta?.precision ?? 2,
          favorite: i.favorite,
          price: q?.price ?? null,
          changePercent: q?.changePercent ?? 0,
          marketStatus: q?.provenance.marketStatus ?? 'CLOSED',
          minPlan: meta?.minPlan ?? 'FREE',
        };
      }),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const input = watchlistSchema.parse(await req.json());
    const symbol = input.symbol.toUpperCase();

    if (!getSymbol(symbol)) return fail('UNKNOWN_SYMBOL', 'Instrumento no disponible.', 404);

    if (input.action === 'REMOVE') {
      await db.watchlistItem.deleteMany({ where: { userId: user.id, symbol } });
    } else if (input.action === 'TOGGLE_FAVORITE') {
      const item = await db.watchlistItem.findUnique({
        where: { userId_symbol: { userId: user.id, symbol } },
      });
      if (item) {
        await db.watchlistItem.update({
          where: { id: item.id },
          data: { favorite: !item.favorite },
        });
      }
    } else {
      const count = await db.watchlistItem.count({ where: { userId: user.id } });
      if (count >= 40) {
        return fail('LIMIT', 'Tu lista de seguimiento admite hasta 40 instrumentos.', 400);
      }
      await db.watchlistItem.upsert({
        where: { userId_symbol: { userId: user.id, symbol } },
        create: { userId: user.id, symbol, position: count },
        update: {},
      });
    }

    await track(ANALYTICS_EVENTS.WATCHLIST_UPDATED, { action: input.action, symbol }, { userId: user.id });
    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
