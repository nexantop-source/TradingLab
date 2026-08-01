import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { subscribeSchema } from '@/lib/validation';
import { billingProvider } from '@/lib/billing';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';
import { DISCLAIMERS } from '@tl/types/compliance';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const input = subscribeSchema.parse(await req.json());

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
    });
  } catch (error) {
    return handleError(error);
  }
}
