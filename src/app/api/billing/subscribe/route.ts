import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { subscribeSchema } from '@/lib/validation';
import { billingProvider } from '@/lib/billing';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';
import { DISCLAIMERS } from '@tl/types/compliance';
import { WompiError } from '@/lib/wompi';
import { enforce } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { isSameOriginRequest } from '@/lib/request-origin';

const MAX_CHECKOUT_BYTES = 8 * 1024;

export async function POST(req: NextRequest) {
  try {
    if (!isSameOriginRequest(req)) return fail('CROSS_SITE_REQUEST', 'No pudimos validar el origen del pago. Vuelve a abrir TradingLab desde su dirección oficial e inténtalo de nuevo.', 403);
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return fail('UNSUPPORTED_MEDIA_TYPE', 'El checkout debe enviarse como JSON.', 415);
    }
    const declaredLength = Number(req.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_CHECKOUT_BYTES) {
      return fail('PAYLOAD_TOO_LARGE', 'La solicitud de checkout supera el tamaño permitido.', 413);
    }

    const { user } = await requireAuth();
    await enforce(`billing-checkout:${user.id}`, { limit: 8, windowSeconds: 300 });
    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_CHECKOUT_BYTES) {
      return fail('PAYLOAD_TOO_LARGE', 'La solicitud de checkout supera el tamaño permitido.', 413);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return fail('VALIDATION_ERROR', 'La solicitud de checkout no contiene JSON válido.', 422);
    }
    const input = subscribeSchema.parse(payload);

    const activeSubscription = await db.subscription.findUnique({
      where: { userId: user.id },
      select: { status: true, currentPeriodEnd: true },
    });
    if (
      activeSubscription &&
      ['ACTIVE', 'TRIALING'].includes(activeSubscription.status) &&
      activeSubscription.currentPeriodEnd > new Date()
    ) {
      return fail(
        'SUBSCRIPTION_ALREADY_ACTIVE',
        'Ya tienes un periodo de pago activo. Para evitar un doble cobro, espera a que finalice antes de comprar otro.',
        409,
      );
    }

    await track(
      ANALYTICS_EVENTS.CHECKOUT_STARTED,
      { planId: input.planId, interval: input.interval },
      { userId: user.id },
    );

    const result = await billingProvider().createCheckout({
      userId: user.id,
      email: user.email,
      planId: input.planId,
      interval: input.interval,
      couponCode: input.couponCode,
      idempotencyKey: input.idempotencyKey,
    });

    return ok({
      ...result,
      notice: DISCLAIMERS.billing,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    if (error instanceof WompiError) {
      return fail(error.code, error.message, error.status);
    }
    return handleError(error);
  }
}
