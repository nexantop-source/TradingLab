import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { parseCheckoutIntent } from '@/lib/checkout-intent';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
import { trialEligibility, TRIAL_DAYS, TRIAL_PLANS } from '@/lib/trials';
import { CheckoutView } from './CheckoutView';

export const metadata: Metadata = { title: 'Revisar pago' };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const intent = parseCheckoutIntent(await searchParams);
  if (!intent) redirect('/precios');
  if (!auth.user.onboardingCompleted) {
    redirect(`/onboarding?plan=${intent.plan}&interval=${intent.interval}`);
  }

  const subscription = await db.subscription.findUnique({
    where: { userId: auth.user.id },
    select: {
      planId: true,
      status: true,
      interval: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  const plan = PLAN_ENTITLEMENTS[intent.plan];
  const eligibility = await trialEligibility(auth.user.id);
  const trialAvailable =
    eligibility.eligible && TRIAL_PLANS.includes(intent.plan as (typeof TRIAL_PLANS)[number]);
  const liveSubscription =
    subscription &&
    ['ACTIVE', 'TRIALING'].includes(subscription.status) &&
    subscription.currentPeriodEnd > new Date()
      ? subscription
      : null;

  return (
    <CheckoutView
      intent={intent}
      trial={trialAvailable ? { days: TRIAL_DAYS } : null}
      plan={{
        name: plan.name,
        tagline: plan.tagline,
        referencePriceUsd:
          intent.interval === 'YEARLY' ? plan.priceYearlyUsd : plan.priceMonthlyUsd,
        highlights: plan.highlights.slice(0, 6),
      }}
      existingSubscription={liveSubscription ? {
        planId: liveSubscription.planId,
        status: liveSubscription.status,
        interval: liveSubscription.interval,
        currentPeriodEnd: liveSubscription.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: liveSubscription.cancelAtPeriodEnd,
      } : null}
    />
  );
}
