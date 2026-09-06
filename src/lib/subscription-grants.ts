import 'server-only';
import { db } from './db';
import { audit } from './analytics';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
import type { PlanId } from '@tl/types';

/**
 * Suscripciones de cortesía.
 *
 * Una cortesía es una suscripción real -concede exactamente los mismos
 * derechos que una pagada- pero de origen distinto, y esa distinción es
 * contable, no cosmética:
 *
 *   · nunca genera un `Payment`, porque no ha habido cobro;
 *   · no computa en el valor mensualizado ni en el ARPU, porque contarla
 *     inventaría ingresos que no existen;
 *   · no se renueva sola: al vencer, la cuenta vuelve a FREE sin cargo.
 *
 * Toda concesión y toda retirada quedan en el registro de auditoría con quién,
 * a quién, qué plan, cuánto tiempo y por qué.
 */

export type GrantablePlan = Extract<PlanId, 'STANDARD' | 'PREMIUM'>;
export const GRANTABLE_PLANS: GrantablePlan[] = ['STANDARD', 'PREMIUM'];

/** Límite deliberado: tres años. Una cortesía indefinida es una cuenta gratis sin revisión. */
export const MAX_GRANT_DAYS = 1095;
export const MIN_GRANT_DAYS = 1;

export class GrantError extends Error {
  readonly status = 409;
  constructor(
    readonly code: 'USER_NOT_FOUND' | 'USER_INACTIVE' | 'PAID_SUBSCRIPTION_ACTIVE' | 'NOT_A_GRANT' | 'NO_SUBSCRIPTION',
    message: string,
  ) {
    super(message);
    this.name = 'GrantError';
  }
}

export interface GrantInput {
  email: string;
  plan: GrantablePlan;
  days: number;
  reason: string;
  actorId: string;
  actorRole: string;
  ipHash?: string | null;
}

export interface GrantResult {
  userId: string;
  email: string;
  name: string;
  plan: GrantablePlan;
  currentPeriodEnd: Date;
  replacedPreviousGrant: boolean;
}

/**
 * Concede una suscripción de cortesía.
 *
 * Si el destinatario ya tiene una cortesía vigente, se sustituye por la nueva.
 * Si tiene una suscripción **de pago** vigente, la operación se rechaza: pisarla
 * destruiría el estado de facturación y el vínculo con la pasarela, y el efecto
 * deseado (más tiempo) se consigue sin riesgo esperando o cancelando primero.
 */
export async function grantSubscription(input: GrantInput): Promise<GrantResult> {
  const email = input.email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, status: true, subscription: true },
  });

  if (!user || user.status === 'DELETED') {
    throw new GrantError('USER_NOT_FOUND', `No hay ninguna cuenta registrada con ${email}.`);
  }
  if (user.status !== 'ACTIVE') {
    throw new GrantError(
      'USER_INACTIVE',
      `La cuenta de ${email} está ${user.status === 'SUSPENDED' ? 'suspendida' : 'inactiva'}. Reactívala antes de concederle un plan.`,
    );
  }

  const now = new Date();
  const existing = user.subscription;
  const paidAndLive =
    existing &&
    existing.source !== 'GRANT' &&
    ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(existing.status) &&
    existing.currentPeriodEnd > now;

  if (paidAndLive) {
    throw new GrantError(
      'PAID_SUBSCRIPTION_ACTIVE',
      `${email} tiene una suscripción de pago vigente hasta el ${existing!.currentPeriodEnd.toLocaleDateString('es')}. Cancélala antes de conceder una cortesía para no perder su estado de facturación.`,
    );
  }

  const days = Math.min(MAX_GRANT_DAYS, Math.max(MIN_GRANT_DAYS, Math.trunc(input.days)));
  const currentPeriodEnd = new Date(now.getTime() + days * 86_400_000);
  const replacedPreviousGrant = Boolean(existing && existing.source === 'GRANT' && existing.currentPeriodEnd > now);

  const data = {
    planId: input.plan,
    status: 'ACTIVE',
    // Una cortesía no tiene periodicidad de cobro; se registra como mensual
    // por compatibilidad del modelo, pero nunca se factura.
    interval: 'MONTHLY',
    currentPeriodStart: now,
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    trialEndsAt: null,
    couponCode: null,
    externalId: null,
    source: 'GRANT',
    grantedById: input.actorId,
    grantedAt: now,
    grantedReason: input.reason.trim(),
  };

  await db.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });

  const planName = PLAN_ENTITLEMENTS[input.plan].name;
  await db.notification.create({
    data: {
      userId: user.id,
      kind: 'SUCCESS',
      title: `Tienes ${planName} activo`,
      body: `El equipo de TradingLab te ha activado el plan ${planName} hasta el ${currentPeriodEnd.toLocaleDateString('es')}. No se te cobrará nada y no se renueva solo.`,
      href: '/perfil',
    },
  });

  await audit({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: 'subscription.grant',
    entity: 'Subscription',
    entityId: user.id,
    diff: {
      recipientEmail: user.email,
      plan: input.plan,
      days,
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      reason: input.reason.trim(),
      replacedPreviousGrant,
      selfGrant: input.actorId === user.id,
    },
    ipHash: input.ipHash,
  });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    plan: input.plan,
    currentPeriodEnd,
    replacedPreviousGrant,
  };
}

/**
 * Retira una cortesía. Solo actúa sobre suscripciones de origen `GRANT`: una
 * suscripción pagada se cancela por su propio flujo de facturación, nunca aquí.
 */
export async function revokeGrant(input: {
  userId: string;
  reason: string;
  actorId: string;
  actorRole: string;
  ipHash?: string | null;
}): Promise<{ email: string; plan: string }> {
  const subscription = await db.subscription.findUnique({
    where: { userId: input.userId },
    include: { user: { select: { email: true } } },
  });

  if (!subscription) {
    throw new GrantError('NO_SUBSCRIPTION', 'Esta cuenta no tiene ninguna suscripción registrada.');
  }
  if (subscription.source !== 'GRANT') {
    throw new GrantError(
      'NOT_A_GRANT',
      'Esta suscripción es de pago, no una cortesía. Cancélala desde el flujo de facturación para no romper su conciliación.',
    );
  }

  const now = new Date();
  await db.subscription.update({
    where: { userId: input.userId },
    data: { status: 'CANCELED', canceledAt: now, cancelAtPeriodEnd: false, currentPeriodEnd: now },
  });

  await audit({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: 'subscription.revoke_grant',
    entity: 'Subscription',
    entityId: input.userId,
    diff: {
      recipientEmail: subscription.user.email,
      plan: subscription.planId,
      reason: input.reason.trim(),
      remainingDays: Math.max(0, Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000)),
    },
    ipHash: input.ipHash,
  });

  return { email: subscription.user.email, plan: subscription.planId };
}

/** Cortesías vigentes, para la tabla del panel. */
export async function listActiveGrants(limit = 50) {
  return db.subscription.findMany({
    where: { source: 'GRANT', status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } },
    orderBy: { grantedAt: 'desc' },
    take: limit,
    include: {
      user: { select: { id: true, email: true, name: true } },
      grantedBy: { select: { name: true, email: true } },
    },
  });
}
