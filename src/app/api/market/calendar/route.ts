import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleError, ok } from '@/lib/api';
import { getEconomicEvents, getEventsForSymbol } from '@tl/market-data';

const querySchema = z.object({
  symbol: z.string().max(20).optional(),
  days: z.coerce.number().int().min(1).max(60).default(14),
  back: z.coerce.number().int().min(0).max(30).default(1),
});

export async function GET(req: NextRequest) {
  try {
    const params = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const from = Date.now() - params.back * 86400000;
    const to = Date.now() + params.days * 86400000;

    const events = params.symbol
      ? getEventsForSymbol(params.symbol, from, to)
      : getEconomicEvents(from, to);

    return ok({ events, from, to });
  } catch (error) {
    return handleError(error);
  }
}
