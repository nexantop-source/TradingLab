import { NextRequest } from 'next/server';
import { fail, handleError, ok, clientIp } from '@/lib/api';
import { requireAuth, hashIp } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { isSameOriginRequest } from '@/lib/request-origin';
import { subscriptionGrantSchema } from '@/lib/validation';
import { grantSubscription, GrantError } from '@/lib/subscription-grants';
import type { Role } from '@tl/types';

/**
 * Concede una suscripción de cortesía.
 *
 * Tres puertas antes de tocar la base de datos: sesión válida, permiso
 * `subscriptions:write` y origen propio. La última importa porque esta ruta se
 * autentica por cookie: sin ella, cualquier página externa podría provocar una
 * concesión mientras la sesión de administración está abierta.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    requirePermission(user.role as Role, 'subscriptions:write');

    if (!isSameOriginRequest(req)) {
      return fail('CROSS_SITE_REQUEST', 'No pudimos validar el origen de la solicitud.', 403);
    }

    const input = subscriptionGrantSchema.parse(await req.json());

    const result = await grantSubscription({
      ...input,
      actorId: user.id,
      actorRole: user.role,
      ipHash: hashIp(clientIp(req)),
    });

    return ok({
      userId: result.userId,
      email: result.email,
      name: result.name,
      plan: result.plan,
      currentPeriodEnd: result.currentPeriodEnd.toISOString(),
      replacedPreviousGrant: result.replacedPreviousGrant,
    });
  } catch (error) {
    if (error instanceof GrantError) return fail(error.code, error.message, error.status);
    return handleError(error);
  }
}
