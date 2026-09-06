import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, ForbiddenError } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import { enforce, RATE_LIMITS } from '@/lib/rate-limit';
import { planAtLeast } from '@tl/types/plans';
import { marketData, requireSymbol } from '@tl/market-data';
import { buildMarketPulse } from '@/packages/market-data/pulse';

export const dynamic = 'force-dynamic';

const query = z.object({
  symbol: z.string().trim().min(1).max(20).transform(value => value.toUpperCase()),
  since: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
});

function privateResponse(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Vary', 'Cookie');
  return response;
}

/** Authenticated demo pulse. No trading action, balance mutation or payment. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    await enforce(`pulse:${auth.user.id}`, RATE_LIMITS.marketData);
    const params = query.parse(Object.fromEntries(req.nextUrl.searchParams));
    const symbol = requireSymbol(params.symbol);
    if (!planAtLeast(auth.user.plan, symbol.minPlan)) {
      throw new ForbiddenError('Este instrumento no está incluido en tu plan actual.');
    }
    const now = Date.now();
    if (params.since != null && params.since > now) {
      return privateResponse(NextResponse.json({ ok: false, error: { code: 'INVALID_CURSOR', message: 'Actualiza la serie para continuar.' } }, { status: 422 }));
    }
    return privateResponse(ok(await buildMarketPulse(marketData(), symbol.symbol, now, params.since)));
  } catch (error) {
    return privateResponse(handleError(error));
  }
}
