import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { billingProvider } from '@/lib/billing';

const bodySchema = z.object({
  /** Por defecto se conserva el acceso hasta el final del periodo pagado. */
  atPeriodEnd: z.boolean().default(true),
  reason: z.string().max(400).optional(),
});

/**
 * Cancelación en un paso.
 *
 * Sin encuestas obligatorias, sin ofertas de retención bloqueantes y sin
 * obligar a contactar con soporte: criterio de aceptación #19.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const input = bodySchema.parse(await req.json().catch(() => ({})));

    const result = await billingProvider().cancel({ userId: user.id, atPeriodEnd: input.atPeriodEnd });

    return ok({
      ...result,
      message: input.atPeriodEnd
        ? 'Tu suscripción se ha cancelado. Conservas el acceso a las funciones de tu plan hasta el final del periodo ya abonado, y no se realizará ningún cargo adicional.'
        : 'Tu suscripción se ha cancelado con efecto inmediato. Tu cuenta pasa al plan Free y conservas todo tu historial educativo.',
    });
  } catch (error) {
    return handleError(error);
  }
}
