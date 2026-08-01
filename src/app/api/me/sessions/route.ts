import { handleError, ok } from '@/lib/api';
import { requireAuth, revokeAllSessions } from '@/lib/auth';

/** Cierra todas las sesiones del usuario salvo la actual. */
export async function DELETE() {
  try {
    const auth = await requireAuth();
    const count = await revokeAllSessions(auth.user.id, auth.sessionId);
    return ok({ revoked: count });
  } catch (error) {
    return handleError(error);
  }
}
