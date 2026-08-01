import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fail, handleError, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { processWebhook } from '@/lib/billing';

/**
 * Webhook de la pasarela de pagos.
 *
 * Dos garantías obligatorias:
 *  · Verificación de firma antes de leer el contenido.
 *  · Idempotencia por identificador de evento: reprocesar el mismo evento no
 *    duplica pagos ni prolonga suscripciones (criterio de aceptación #17).
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const signature = req.headers.get('x-webhook-signature');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (secret) {
      if (!signature || !verifySignature(raw, signature, secret)) {
        return fail('INVALID_SIGNATURE', 'La firma del webhook no es válida.', 401);
      }
    } else if (process.env.NODE_ENV === 'production') {
      return fail('WEBHOOK_NOT_CONFIGURED', 'El webhook no está configurado en este entorno.', 503);
    }

    const event = JSON.parse(raw) as {
      id: string;
      type: string;
      data?: { userId?: string; planId?: string; amountCents?: number; periodEnd?: string };
    };

    if (!event.id || !event.type) {
      return fail('INVALID_PAYLOAD', 'El evento no incluye identificador o tipo.', 400);
    }

    const result = await processWebhook({
      provider: process.env.BILLING_PROVIDER ?? 'mock',
      externalId: event.id,
      type: event.type,
      payload: event,
      handler: async () => {
        const userId = event.data?.userId;
        if (!userId) return;

        switch (event.type) {
          case 'invoice.paid': {
            await db.payment.upsert({
              where: { idempotencyKey: `wh:${event.id}` },
              create: {
                userId,
                amountCents: event.data?.amountCents ?? 0,
                status: 'SUCCEEDED',
                description: 'Renovación de suscripción',
                idempotencyKey: `wh:${event.id}`,
                externalId: event.id,
                processedAt: new Date(),
              },
              update: {},
            });
            if (event.data?.periodEnd) {
              await db.subscription.updateMany({
                where: { userId },
                data: { status: 'ACTIVE', currentPeriodEnd: new Date(event.data.periodEnd) },
              });
            }
            break;
          }
          case 'invoice.payment_failed': {
            await db.subscription.updateMany({ where: { userId }, data: { status: 'PAST_DUE' } });
            await db.notification.create({
              data: {
                userId,
                kind: 'WARNING',
                title: 'No hemos podido procesar tu pago',
                body: 'Revisa tu método de pago desde el portal de suscripción. Conservas el acceso durante unos días mientras lo resuelves.',
                href: '/perfil/suscripcion',
              },
            });
            break;
          }
          case 'customer.subscription.deleted': {
            await db.subscription.updateMany({
              where: { userId },
              data: { status: 'CANCELED', canceledAt: new Date() },
            });
            break;
          }
          default:
            // Los eventos no contemplados se registran igualmente en
            // `WebhookEvent`, para poder revisarlos después.
            break;
        }
      },
    });

    return ok({ received: true, duplicate: result.duplicate });
  } catch (error) {
    return handleError(error);
  }
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
