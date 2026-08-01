import { handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { resetBalance } from '@/lib/demo-account';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';

/**
 * Reinicio del saldo virtual.
 *
 * No borra historial: añade el asiento de corrección al libro mayor, de modo
 * que la trazabilidad se mantiene intacta.
 */
export async function POST() {
  try {
    const { user } = await requireAuth();
    const result = await resetBalance(user.id, user.plan);

    await track(
      ANALYTICS_EVENTS.BALANCE_RESET,
      { resetsUsed: result.resetsUsed, plan: user.plan },
      { userId: user.id },
    );

    return ok({
      ...result,
      message:
        'Tu saldo virtual vuelve a USD 10.000. El historial de simulaciones y tu diario se conservan: el reinicio queda registrado como un asiento más en el libro mayor de tu cuenta.',
    });
  } catch (error) {
    return handleError(error);
  }
}
