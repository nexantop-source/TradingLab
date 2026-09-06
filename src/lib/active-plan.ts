import type { PlanId } from '@tl/types';

/** Free is the base entitlement, never a checkout or a subscription to activate. */
export function resolveActivePlan(subscription: { planId: string; status: string; currentPeriodEnd: Date } | null | undefined, now = new Date()): PlanId {
  if (!subscription || !['ACTIVE', 'TRIALING'].includes(subscription.status) || !(subscription.currentPeriodEnd > now)) return 'FREE';
  return subscription.planId === 'STANDARD' || subscription.planId === 'PREMIUM' ? subscription.planId : 'FREE';
}
