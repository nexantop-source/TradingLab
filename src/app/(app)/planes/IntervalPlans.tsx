'use client';
import { PricingPlans } from '@/components/investment/PricingPlans';
import type { PlanId } from '@tl/types';

/** The public and account pages share prices, limits, and interaction patterns. */
export function IntervalPlans({ plans, trialDays }: { plans: Array<{ id: string; isCurrent: boolean; trialAvailable: boolean }>; trialDays: number }) {
  const current = plans.find(p => p.isCurrent)?.id as PlanId | undefined;
  return <PricingPlans heading={false} currentPlan={current ?? 'FREE'} trialDays={plans.some(p => p.trialAvailable) ? trialDays : undefined} compact />;
}
