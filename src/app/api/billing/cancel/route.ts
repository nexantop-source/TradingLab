import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { billingProvider } from '@/lib/billing';
import { enforce } from '@/lib/rate-limit';
import { isSameOriginRequest } from '@/lib/request-origin';

const MAX_CANCEL_BYTES = 2 * 1024;
const bodySchema = z
  .object({
    /** Por defecto se conserva el acceso hasta el final del periodo pagado. */
    atPeriodEnd: z.boolean().default(true),
    reason: z.string().trim().max(400).optional(),
  })
  .strict();

/**
 * Cancelación en un paso.
 *
 * Sin encuestas obligatorias, sin ofertas de retención bloqueantes y sin
 * obligar a contactar con soporte: criterio de aceptación #19.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isSameOriginRequest(req)) return fail('CROSS_SITE_REQUEST', 'Solicitud de cancelación no permitida.', 403);
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return fail('UNSUPPORTED_MEDIA_TYPE', 'La cancelación debe enviarse como JSON.', 415);
    }
    const declaredLength = Number(req.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_CANCEL_BYTES) {
      return fail('PAYLOAD_TOO_LARGE', 'La solicitud de cancelación supera el tamaño permitido.', 413);
    }

    const { user } = await requireAuth();
    await enforce(`billing-cancel:${user.id}`, { limit: 6, windowSeconds: 3600 });
    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_CANCEL_BYTES) {
      return fail('PAYLOAD_TOO_LARGE', 'La solicitud de cancelación supera el tamaño permitido.', 413);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return fail('VALIDATION_ERROR', 'La solicitud de cancelación no contiene JSON válido.', 422);
    }
    const input = bodySchema.parse(payload);

    const result = await billingProvider().cancel({ userId: user.id, atPeriodEnd: input.atPeriodEnd });

    return ok({
      ...result,
      message: input.atPeriodEnd
        ? 'La finalización quedó registrada. Conservas el acceso a las funciones de tu plan hasta el final del periodo ya abonado y no se programó ningún pago nuevo.'
        : 'Tu suscripción se ha cancelado con efecto inmediato. Tu cuenta pasa al plan Free y conservas todo tu historial educativo.',
    });
  } catch (error) {
    return handleError(error);
  }
}
