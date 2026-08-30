import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { processWebhook } from '@/lib/billing';
import {
  fetchWompiTransaction,
  parseWompiWebhookEvent,
  readWompiConfig,
  reconcileWompiTransaction,
  redactedWompiEvent,
  verifyWompiEventSignature,
  webhookTransaction,
  wompiEventFingerprint,
  WompiError,
} from '@/lib/wompi';

const MAX_WEBHOOK_BYTES = 64 * 1024;

/**
 * Webhook Wompi endurecido:
 *  1. limita y valida el cuerpo;
 *  2. verifica el checksum dinámico y el ambiente;
 *  3. consulta la transacción directamente a Wompi;
 *  4. aplica la transición de manera idempotente en base de datos.
 */
export async function POST(req: NextRequest) {
  try {
    if ((process.env.BILLING_PROVIDER ?? 'disabled').trim().toLowerCase() !== 'wompi') {
      return fail('WEBHOOK_NOT_AVAILABLE', 'El webhook Wompi no está habilitado.', 404);
    }

    const contentType = req.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.startsWith('application/json')) {
      return fail('UNSUPPORTED_MEDIA_TYPE', 'El webhook debe enviar application/json.', 415);
    }

    const declaredLength = Number(req.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
      return fail('PAYLOAD_TOO_LARGE', 'El webhook supera el tamaño permitido.', 413);
    }

    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_WEBHOOK_BYTES) {
      return fail('PAYLOAD_TOO_LARGE', 'El webhook supera el tamaño permitido.', 413);
    }

    const event = parseWompiWebhookEvent(raw);
    const config = readWompiConfig(process.env, { requireEvents: true });
    if (event.environment !== config.eventEnvironment) {
      return fail(
        'WOMPI_ENVIRONMENT_MISMATCH',
        'El evento pertenece a un ambiente Wompi diferente.',
        401,
      );
    }

    const validSignature = verifyWompiEventSignature(
      event,
      config.eventsSecret,
      req.headers.get('x-event-checksum'),
    );
    if (!validSignature) {
      return fail('INVALID_SIGNATURE', 'La firma del webhook no es válida.', 401);
    }

    // Wompi puede enviar otros tipos de evento a la misma URL. Tras validar la
    // firma se reconocen sin aplicar mutaciones y se evita un ciclo de reintentos.
    if (event.event !== 'transaction.updated') {
      return ok({ received: true, ignored: true });
    }

    const notifiedTransaction = webhookTransaction(event);
    const externalId = wompiEventFingerprint(event);
    const result = await processWebhook({
      provider: 'wompi',
      externalId,
      type: event.event,
      // No persistimos email, método de pago ni otros datos personales del
      // payload; solo los campos mínimos para auditoría operativa.
      payload: redactedWompiEvent(event),
      handler: async () => {
        const authoritative = await fetchWompiTransaction(notifiedTransaction.id, config);
        await reconcileWompiTransaction(authoritative);
      },
    });

    return ok({ received: true, duplicate: result.duplicate });
  } catch (error) {
    if (error instanceof WompiError) {
      return fail(error.code, error.message, error.status);
    }
    return handleError(error);
  }
}
