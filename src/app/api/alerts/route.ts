import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { alertSchema } from '@/lib/validation';
import { getSymbol } from '@tl/market-data';
import { entitlements } from '@tl/types/plans';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';

export async function GET() {
  try {
    const { user } = await requireAuth();
    const alerts = await db.alert.findMany({
      where: { userId: user.id },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return ok({
      alerts: alerts.map((a) => ({
        ...a,
        assetName: getSymbol(a.symbol)?.name ?? a.symbol,
        createdAt: a.createdAt.toISOString(),
        triggeredAt: a.triggeredAt?.toISOString() ?? null,
      })),
      limit: entitlements(user.plan).alerts,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const input = alertSchema.parse(await req.json());
    const symbol = input.symbol.toUpperCase();

    if (!getSymbol(symbol)) return fail('UNKNOWN_SYMBOL', 'Instrumento no disponible.', 404);

    const limit = entitlements(user.plan).alerts;
    const active = await db.alert.count({ where: { userId: user.id, active: true } });
    if (active >= limit) {
      return fail(
        'ALERT_LIMIT',
        `Tu plan admite ${limit} alertas activas a la vez. Desactiva alguna o mejora tu plan.`,
        403,
      );
    }

    const alert = await db.alert.create({
      data: {
        userId: user.id,
        symbol,
        kind: input.kind,
        condition: input.condition,
        threshold: input.threshold,
        note: input.note,
      },
    });

    await track(ANALYTICS_EVENTS.ALERT_CREATED, { symbol, condition: input.condition }, { userId: user.id });
    return ok({ id: alert.id }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return fail('MISSING_ID', 'Indica la alerta a eliminar.', 400);
    await db.alert.deleteMany({ where: { id, userId: user.id } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
