import { NextRequest } from 'next/server';
import { fail, handleError, ok, clientIp } from '@/lib/api';
import { requireAuth, hashIp } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { isSameOriginRequest } from '@/lib/request-origin';
import { subscriptionRevokeSchema } from '@/lib/validation';
import { revokeGrant, GrantError } from '@/lib/subscription-grants';
import type { Role } from '@tl/types';

/** Retira una suscripción de cortesía. Nunca toca una suscripción de pago. */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    requirePermission(user.role as Role, 'subscriptions:write');

    if (!isSameOriginRequest(req)) {
      return fail('CROSS_SITE_REQUEST', 'No pudimos validar el origen de la solicitud.', 403);
    }

    const input = subscriptionRevokeSchema.parse(await req.json());

    const result = await revokeGrant({
      ...input,
      actorId: user.id,
      actorRole: user.role,
      ipHash: hashIp(clientIp(req)),
    });

    return ok(result);
  } catch (error) {
    if (error instanceof GrantError) return fail(error.code, error.message, error.status);
    return handleError(error);
  }
}
