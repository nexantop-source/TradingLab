import 'server-only';
import { db } from './db';
import { PLAN_ENTITLEMENTS, PREMIUM_TRIAL_DAYS } from '@tl/types/plans';
import type { PlanId } from '@tl/types';
import { audit, track } from './analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';
import { WompiBillingProvider, WompiError } from './wompi';

/**
 * Capa de facturación.
 *
 * Aísla la pasarela real detrás de una interfaz. En desarrollo puede usarse
 * `mock` para recorrer el producto sin credenciales. Producción falla cerrada:
 * el mock está prohibido y `disabled` nunca activa una membresía.
 *
 * En producción puede seleccionarse Wompi. El navegador solo recibe una URL
 * firmada de Checkout; la membresía se activa desde el webhook reconciliado.
 * Ver docs/DEPLOYMENT.md.
 */

export interface CheckoutResult {
  status: 'ACTIVE' | 'TRIALING' | 'REDIRECT';
  /** URL de la pasarela cuando el proveedor requiere redirección. */
  redirectUrl?: string;
  /** Importe exacto calculado por servidor y firmado para la pasarela. */
  amountInCents?: number;
  currency?: 'COP' | 'USD';
  subscriptionId: string;
  currentPeriodEnd: string;
}

export interface BillingProvider {
  readonly id: string;
  createCheckout(params: {
    userId: string;
    email: string;
    planId: Exclude<PlanId, 'FREE'>;
    interval: 'MONTHLY' | 'YEARLY';
    couponCode?: string;
    idempotencyKey: string;
  }): Promise<CheckoutResult>;
  cancel(params: { userId: string; atPeriodEnd: boolean }): Promise<{ canceledAt: string; accessUntil: string }>;
  resume(params: { userId: string }): Promise<{ resumed: boolean }>;
}

// ─────────────────────────────────────────────────────────────────────────────

class MockBillingProvider implements BillingProvider {
  readonly id = 'mock';

  async createCheckout(params: {
    userId: string;
    email: string;
    planId: Exclude<PlanId, 'FREE'>;
    interval: 'MONTHLY' | 'YEARLY';
    couponCode?: string;
    idempotencyKey: string;
  }): Promise<CheckoutResult> {
    const plan = PLAN_ENTITLEMENTS[params.planId];
    const priceCents =
      params.interval === 'YEARLY'
        ? Math.round(plan.priceYearlyUsd * 100)
        : Math.round(plan.priceMonthlyUsd * 100);

    const discount = await resolveCoupon(params.couponCode, params.planId);
    const finalCents = Math.max(0, priceCents - discount.amountOffCents - Math.round((priceCents * discount.percentOff) / 100));

    // Idempotencia: si el pago con esta clave ya se procesó, no se duplica.
    const existingPayment = await db.payment.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      select: { id: true },
    });

    const existingSub = await db.subscription.findUnique({ where: { userId: params.userId } });
    const hadPaidPlan = Boolean(existingSub && existingSub.planId !== 'FREE');

    // Prueba de Premium solo para quien no haya tenido un plan de pago antes.
    const useTrial = params.planId === 'PREMIUM' && !hadPaidPlan;
    const now = Date.now();
    const periodMs = params.interval === 'YEARLY' ? 365 * 86400000 : 30 * 86400000;
    const trialEndsAt = useTrial ? new Date(now + PREMIUM_TRIAL_DAYS * 86400000) : null;
    const currentPeriodEnd = new Date(now + (useTrial ? PREMIUM_TRIAL_DAYS * 86400000 : periodMs));

    const subscription = await db.subscription.upsert({
      where: { userId: params.userId },
      create: {
        userId: params.userId,
        planId: params.planId,
        status: useTrial ? 'TRIALING' : 'ACTIVE',
        interval: params.interval,
        currentPeriodStart: new Date(now),
        currentPeriodEnd,
        trialEndsAt,
        couponCode: discount.code,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      update: {
        planId: params.planId,
        status: useTrial ? 'TRIALING' : 'ACTIVE',
        interval: params.interval,
        currentPeriodStart: new Date(now),
        currentPeriodEnd,
        trialEndsAt,
        couponCode: discount.code,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });

    if (!existingPayment && !useTrial) {
      await db.payment.create({
        data: {
          userId: params.userId,
          amountCents: finalCents,
          currency: 'USD',
          status: 'SUCCEEDED',
          description: `Suscripción ${plan.name} (${params.interval === 'YEARLY' ? 'anual' : 'mensual'})`,
          idempotencyKey: params.idempotencyKey,
          processedAt: new Date(),
        },
      });
    }

    if (discount.id) {
      await db.coupon.update({ where: { id: discount.id }, data: { timesRedeemed: { increment: 1 } } });
    }

    await track(
      useTrial ? ANALYTICS_EVENTS.TRIAL_STARTED : ANALYTICS_EVENTS.SUBSCRIPTION_STARTED,
      { planId: params.planId, interval: params.interval, amountCents: finalCents, coupon: discount.code },
      { userId: params.userId },
    );

    return {
      status: useTrial ? 'TRIALING' : 'ACTIVE',
      subscriptionId: subscription.id,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
    };
  }

  async cancel(params: { userId: string; atPeriodEnd: boolean }) {
    const sub = await db.subscription.findUnique({ where: { userId: params.userId } });
    if (!sub) throw new Error('No hay ninguna suscripción activa que cancelar.');

    const canceledAt = new Date();
    await db.subscription.update({
      where: { userId: params.userId },
      data: {
        cancelAtPeriodEnd: params.atPeriodEnd,
        canceledAt,
        status: params.atPeriodEnd ? sub.status : 'CANCELED',
        ...(params.atPeriodEnd ? {} : { currentPeriodEnd: canceledAt }),
      },
    });

    await track(
      ANALYTICS_EVENTS.SUBSCRIPTION_CANCELED,
      { planId: sub.planId, atPeriodEnd: params.atPeriodEnd },
      { userId: params.userId },
    );

    return {
      canceledAt: canceledAt.toISOString(),
      accessUntil: (params.atPeriodEnd ? sub.currentPeriodEnd : canceledAt).toISOString(),
    };
  }

  async resume(params: { userId: string }) {
    await db.subscription.update({
      where: { userId: params.userId },
      data: { cancelAtPeriodEnd: false, canceledAt: null, status: 'ACTIVE' },
    });
    return { resumed: true };
  }
}

class DisabledBillingProvider implements BillingProvider {
  readonly id = 'disabled';

  private unavailable(): never {
    throw new WompiError(
      'BILLING_NOT_CONFIGURED',
      'Los pagos todavía no están habilitados. No se realizó ningún cargo ni se activó una membresía.',
      503,
    );
  }

  async createCheckout(): Promise<CheckoutResult> {
    return this.unavailable();
  }

  async cancel(): Promise<{ canceledAt: string; accessUntil: string }> {
    return this.unavailable();
  }

  async resume(): Promise<{ resumed: boolean }> {
    return this.unavailable();
  }
}

async function resolveCoupon(
  code: string | undefined,
  planId: PlanId,
): Promise<{ id: string | null; code: string | null; percentOff: number; amountOffCents: number }> {
  if (!code) return { id: null, code: null, percentOff: 0, amountOffCents: 0 };

  const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon || !coupon.active) return { id: null, code: null, percentOff: 0, amountOffCents: 0 };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { id: null, code: null, percentOff: 0, amountOffCents: 0 };
  if (coupon.maxRedemptions && coupon.timesRedeemed >= coupon.maxRedemptions) {
    return { id: null, code: null, percentOff: 0, amountOffCents: 0 };
  }
  if (coupon.appliesToPlanId && coupon.appliesToPlanId !== planId) {
    return { id: null, code: null, percentOff: 0, amountOffCents: 0 };
  }

  return {
    id: coupon.id,
    code: coupon.code,
    percentOff: coupon.percentOff ?? 0,
    amountOffCents: coupon.amountOffCents ?? 0,
  };
}

let provider: BillingProvider | null = null;

export function resolveBillingProviderId(
  env: Readonly<Record<string, string | undefined>> = process.env,
): 'wompi' | 'mock' | 'disabled' {
  const providerId = (env.BILLING_PROVIDER ?? (env.NODE_ENV === 'production' ? 'disabled' : 'mock'))
    .trim()
    .toLowerCase();

  if (providerId === 'mock' && env.NODE_ENV === 'production') {
    throw new WompiError(
      'BILLING_MOCK_FORBIDDEN',
      'La facturación simulada está bloqueada en producción.',
      503,
    );
  }
  if (providerId === 'off') return 'disabled';
  if (providerId === 'wompi' || providerId === 'mock' || providerId === 'disabled') return providerId;
  throw new WompiError(
    'BILLING_PROVIDER_UNSUPPORTED',
    `El proveedor de pagos "${providerId}" no está implementado.`,
    503,
  );
}

export function billingProvider(): BillingProvider {
  if (!provider) {
    const providerId = resolveBillingProviderId();
    if (providerId === 'wompi') {
      provider = new WompiBillingProvider();
    } else if (providerId === 'mock') {
      provider = new MockBillingProvider();
    } else {
      provider = new DisabledBillingProvider();
    }
  }
  return provider;
}

/**
 * Procesa un evento de webhook de forma idempotente.
 * Criterio de aceptación #17: un mismo evento no puede aplicarse dos veces.
 */
export async function processWebhook(params: {
  provider: string;
  externalId: string;
  type: string;
  payload: unknown;
  handler: () => Promise<void>;
}): Promise<{ processed: boolean; duplicate: boolean }> {
  const existing = await db.webhookEvent.findUnique({
    where: { provider_externalId: { provider: params.provider, externalId: params.externalId } },
  });

  if (existing?.processedAt) return { processed: true, duplicate: true };

  const event = await db.webhookEvent.upsert({
    where: { provider_externalId: { provider: params.provider, externalId: params.externalId } },
    create: {
      provider: params.provider,
      externalId: params.externalId,
      type: params.type,
      payload: JSON.stringify(params.payload),
    },
    update: {},
  });

  try {
    await params.handler();
    await db.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), error: null } });
    return { processed: true, duplicate: false };
  } catch (error) {
    await db.webhookEvent.update({
      where: { id: event.id },
      data: { error: error instanceof Error ? error.message.slice(0, 500) : 'error desconocido' },
    });
    throw error;
  }
}

/** Métricas de suscripción para el panel de negocio. */
export async function subscriptionMetrics() {
  const subs = await db.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING'] },
      currentPeriodEnd: { gt: new Date() },
    },
    select: { planId: true, interval: true, status: true },
  });

  let mrrCents = 0;
  const byPlan: Record<string, number> = { STANDARD: 0, PREMIUM: 0 };

  for (const s of subs) {
    if (s.status === 'TRIALING') continue;
    const plan = PLAN_ENTITLEMENTS[s.planId as PlanId];
    if (!plan) continue;
    const monthly =
      s.interval === 'YEARLY' ? (plan.priceYearlyUsd * 100) / 12 : plan.priceMonthlyUsd * 100;
    mrrCents += monthly;
    byPlan[s.planId] = (byPlan[s.planId] ?? 0) + 1;
  }

  const [totalUsers, canceledLast30] = await Promise.all([
    db.user.count({ where: { status: 'ACTIVE' } }),
    db.subscription.count({
      where: { canceledAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    }),
  ]);

  const activePaying = subs.filter((s) => s.status === 'ACTIVE').length;

  return {
    mrrUsd: Number((mrrCents / 100).toFixed(2)),
    arrUsd: Number(((mrrCents * 12) / 100).toFixed(2)),
    activePaying,
    trialing: subs.filter((s) => s.status === 'TRIALING').length,
    byPlan,
    totalUsers,
    churnPercent: activePaying + canceledLast30 > 0
      ? Number(((canceledLast30 / (activePaying + canceledLast30)) * 100).toFixed(2))
      : 0,
    conversionPercent: totalUsers > 0 ? Number(((activePaying / totalUsers) * 100).toFixed(2)) : 0,
    arpuUsd: totalUsers > 0 ? Number((mrrCents / 100 / totalUsers).toFixed(2)) : 0,
  };
}

export { audit };
