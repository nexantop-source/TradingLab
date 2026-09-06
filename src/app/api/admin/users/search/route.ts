import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { db } from '@/lib/db';
import { resolveActivePlan } from '@/lib/active-plan';
import type { Role } from '@tl/types';

/**
 * Buscador de cuentas para el panel. Devuelve lo mínimo para identificar a una
 * persona y decidir si concederle un plan: nunca contraseñas, sesiones,
 * consentimientos ni datos de pago.
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    requirePermission(user.role as Role, 'users:read');

    const query = req.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (query.length < 2) {
      return fail('QUERY_TOO_SHORT', 'Escribe al menos dos caracteres para buscar.', 400);
    }

    const users = await db.user.findMany({
      where: {
        status: { not: 'DELETED' },
        OR: [{ email: { contains: query } }, { name: { contains: query } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        subscription: {
          select: { planId: true, status: true, currentPeriodEnd: true, source: true },
        },
      },
    });

    return ok({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        activePlan: resolveActivePlan(u.subscription),
        subscriptionSource: u.subscription?.source ?? null,
        currentPeriodEnd: u.subscription?.currentPeriodEnd?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
