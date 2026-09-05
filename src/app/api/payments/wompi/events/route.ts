import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { processWebhook } from '@/lib/billing';
import { fetchWompiTransaction, parseWompiWebhookEvent, readWompiConfig, reconcileWompiTransaction, redactedWompiEvent, verifyWompiEventSignature, webhookTransaction, wompiEventFingerprint, WompiError } from '@/lib/wompi';
import { forwardNexantWompiEvent, wompiProject } from '@/lib/wompi-routing';

export const dynamic = 'force-dynamic';

/** Read-only liveness/configuration check; never claims a payment was processed. */
export async function GET() {
  if (process.env.WOMPI_EVENT_HUB_ENABLED !== 'true') return fail('EVENT_HUB_DISABLED', 'El receptor compartido no está habilitado.', 503);
  try {
    const config = readWompiConfig(process.env, { requireEvents: true });
    return ok({ service: 'wompi-events', environment: config.environment, checkoutEnabled: process.env.BILLING_PROVIDER === 'wompi' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return fail('EVENT_HUB_NOT_CONFIGURED', 'El receptor requiere configuración.', 503); }
}

export async function POST(req: NextRequest) {
  try {
    if (process.env.WOMPI_EVENT_HUB_ENABLED !== 'true') return fail('EVENT_HUB_DISABLED', 'El receptor compartido no está habilitado.', 404);
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return fail('UNSUPPORTED_MEDIA_TYPE', 'Se requiere application/json.', 415);
    if (Number(req.headers.get('content-length') ?? '0') > 65536) return fail('PAYLOAD_TOO_LARGE', 'Evento demasiado grande.', 413);
    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > 65536) return fail('PAYLOAD_TOO_LARGE', 'Evento demasiado grande.', 413);
    const event = parseWompiWebhookEvent(raw);
    const config = readWompiConfig(process.env, { requireEvents: true });
    if (event.environment !== config.eventEnvironment || !verifyWompiEventSignature(event, config.eventsSecret, req.headers.get('x-event-checksum'))) return fail('INVALID_SIGNATURE', 'Firma o ambiente no válidos.', 401);
    if (event.event !== 'transaction.updated') return ok({ received: true, ignored: true });

    const notified = webhookTransaction(event);
    // Persist receipt BEFORE provider lookup/forwarding, including unavailable
    // destinations and unknown orders. Failed receipts remain visible for recovery.
    const result = await processWebhook({
      provider: 'wompi-hub',
      externalId: wompiEventFingerprint(event), type: event.event,
      payload: redactedWompiEvent(event),
      handler: async () => {
        // Only the signed ID selects the authoritative routing information.
        const transaction = await fetchWompiTransaction(notified.id, config);
        const project = wompiProject(transaction);
        if (!project) throw new WompiError('PROJECT_NOT_IDENTIFIED', 'La transacción requiere revisión de proyecto.', 409);
        if (project === 'tradinglab') {
          // Receipt/reconciliation is independent of checkout availability: old
          // purchases must continue processing even when new sales are paused.
          await reconcileWompiTransaction(transaction);
        } else {
          if (config.environment !== 'production') throw new WompiError('DESTINATION_NOT_CONFIGURED', 'No hay receptor Nexant de pruebas configurado.', 503);
          await forwardNexantWompiEvent(raw, event.signature.checksum);
        }
      },
    });
    // Persisted completion only after receiver acknowledgement. Failures stay
    // retryable; do not claim success and lose the provider's retry attempts.
    return ok({ received: true, duplicate: result.duplicate });
  } catch (error) {
    if (error instanceof WompiError) return fail(error.code, error.message, error.status);
    return handleError(error);
  }
}
