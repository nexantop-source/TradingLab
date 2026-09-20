import type { PlanId } from '@tl/types';

/** Free is the base entitlement, never a checkout or a subscription to activate. */
export function resolveActivePlan(subscription: { planId: string; status: string; currentPeriodEnd: Date } | null | undefined, now = new Date()): PlanId {
  if (!subscription || !['ACTIVE', 'TRIALING'].includes(subscription.status) || !(subscription.currentPeriodEnd > now)) return 'FREE';
  return subscription.planId === 'STANDARD' || subscription.planId === 'PREMIUM' ? subscription.planId : 'FREE';
}

/** A sandbox or legacy unverified trial must not unlock production features. */
export function trialAccessVerified(subscription: { status: string; source?: string; paymentSource?: { environment: string; mandates: Array<{ verificationTransactionId: string | null; verificationAmountCents: number | null }> } | null } | null | undefined, production: boolean): boolean {
  if (production && subscription?.source === 'MOCK') return false;
  if (!production || subscription?.status !== 'TRIALING') return true;
  return subscription.source === 'TRIAL' && subscription.paymentSource?.environment === 'production'
    && subscription.paymentSource.mandates.some(m => Boolean(m.verificationTransactionId) && m.verificationAmountCents === 150_000) === true;
}
