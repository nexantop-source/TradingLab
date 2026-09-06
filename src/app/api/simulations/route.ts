import { NextRequest } from 'next/server';
import { handleError, ok, clientIp } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { enforce, RATE_LIMITS } from '@/lib/rate-limit';
import { createSimulationSchema } from '@tl/simulation-engine';
import { createSimulation, listOpenPositions, settleDueSimulations } from '@/lib/simulation-service';
import { db } from '@/lib/db';
import { historyCutoff } from '@/lib/entitlements';
import { fromJson } from '@/lib/json';
import { requireSymbol } from '@tl/market-data';
import { ensureDemoAccount } from '@/lib/demo-account';

/** Crea una simulación. */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    await enforce(`sim:${user.id}`, RATE_LIMITS.simulationCreate);

    const body = await req.json();
    const input = createSimulationSchema.parse(body);

    const result = await createSimulation({
      userId: user.id,
      plan: user.plan,
      timezone: user.timezone,
      input,
    });

    return ok(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

/** Lista posiciones abiertas e historial reciente. */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth();

    // Liquida vencimientos y disparos antes de responder, para que la vista
    // sea coherente con el estado real.
    await settleDueSimulations(user.id);
    const account = await ensureDemoAccount(user.id);
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const simulationsUsedToday = await db.simulation.count({ where: { userId: user.id, openedAt: { gte: dayStart } } });

    const status = req.nextUrl.searchParams.get('status') ?? 'all';
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200);

    const open = status === 'closed' ? [] : await listOpenPositions(user.id);

    const closed =
      status === 'open'
        ? []
        : await db.simulation.findMany({
            where: { userId: user.id, status: 'CLOSED', closedAt: { gte: historyCutoff(user.plan) } },
            orderBy: { closedAt: 'desc' },
            take: limit,
          });

    return ok({
      balanceCents: account.balanceCents,
      simulationsUsedToday,
      open,
      closed: closed.map((s) => {
        const meta = requireSymbol(s.symbol);
        return {
          id: s.id,
          mode: s.mode,
          symbol: s.symbol,
          assetName: meta.name,
          precision: meta.precision,
          direction: s.direction,
          outcome: s.outcome,
          entryPrice: s.entryPrice,
          exitPrice: s.exitPrice,
          stakeCents: s.stakeCents,
          pnlCents: s.pnlCents,
          leverage: s.leverage,
          stopLoss: s.stopLoss,
          takeProfit: s.takeProfit,
          openedAt: s.openedAt.toISOString(),
          closedAt: s.closedAt?.toISOString() ?? null,
          closeReason: s.closeReason,
          rationale: s.rationale,
          confidence: s.confidence,
          strategyTag: s.strategyTag,
          engineVersion: s.engineVersion,
          priceSourceProvider: s.priceSourceProvider,
          audit: fromJson<string[]>(s.settlementAudit, []),
        };
      }),
      historyCutoff: historyCutoff(user.plan).toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
  } catch (error) {
    return handleError(error);
  }
}
