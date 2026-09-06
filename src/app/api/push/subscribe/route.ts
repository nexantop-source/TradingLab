import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { isSameOriginRequest } from '@/lib/request-origin';
import { db } from '@/lib/db';
import { pushConfigured, vapidPublicKey } from '@/lib/push';

const subscriptionSchema = z
  .object({
    endpoint: z.string().trim().url().max(2000),
    keys: z.object({
      p256dh: z.string().trim().min(20).max(200),
      auth: z.string().trim().min(10).max(100),
    }),
  })
  .strict();

/** Clave pública VAPID y estado de la suscripción de este dispositivo. */
export async function GET() {
  try {
    await requireAuth();
    return ok({ configured: pushConfigured(), publicKey: vapidPublicKey() });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Registra el dispositivo actual.
 *
 * El endpoint es único: si ya existía asociado a otra cuenta (mismo navegador,
 * otra persona), se reasigna en lugar de duplicarse. De lo contrario un
 * dispositivo compartido acabaría recibiendo los recordatorios de quien lo usó
 * antes.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    if (!isSameOriginRequest(req)) {
      return fail('CROSS_SITE_REQUEST', 'No pudimos validar el origen de la solicitud.', 403);
    }
    if (!pushConfigured()) {
      return fail('PUSH_NOT_CONFIGURED', 'Las notificaciones no están disponibles en esta instalación.', 503);
    }

    const input = subscriptionSchema.parse(await req.json());
    const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null;

    await db.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId: user.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent,
      },
      update: {
        userId: user.id,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent,
        failureCount: 0,
      },
    });

    // Registrar el dispositivo no activa el recordatorio: eso es una decisión
    // aparte que la persona toma en su perfil.
    return ok({ registered: true });
  } catch (error) {
    return handleError(error);
  }
}

/** Da de baja este dispositivo. */
export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    if (!isSameOriginRequest(req)) {
      return fail('CROSS_SITE_REQUEST', 'No pudimos validar el origen de la solicitud.', 403);
    }
    const endpoint = req.nextUrl.searchParams.get('endpoint');
    if (!endpoint) return fail('MISSING_ENDPOINT', 'Falta el identificador del dispositivo.', 400);

    // El filtro por `userId` impide dar de baja el dispositivo de otra cuenta
    // aunque se conozca su endpoint.
    await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
    return ok({ removed: true });
  } catch (error) {
    return handleError(error);
  }
}
