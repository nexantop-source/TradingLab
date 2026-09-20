import 'server-only';
import { randomBytes } from 'node:crypto';
import { db } from './db';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
import type { PlanId } from '@tl/types';
import {
  readWompiConfig,
  WompiError,
  wompiAmountInCents,
  wompiPaymentDescription,
  wompiPaymentIdempotencyKey,
  wompiReference,
  type WompiInterval,
  type WompiPlanId,
} from './wompi';
import {
  CARD_VERIFICATION_AMOUNT_IN_CENTS,
  chargePaymentSource,
  createPaymentSource,
  verifyPaymentSource,
} from './wompi-recurring';
import { convertUsdToCopCents, currentTrm, exchangeQuoteTag } from './cop-exchange';
import { track } from './analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';

/**
 * Prueba gratuita con tarjeta guardada.
 *
 * El trato con la persona es explícito y verificable: deja su tarjeta, usa el
 * plan durante los días de prueba y, si no cancela antes, se le cobra el primer
 * periodo. Todo lo que hace falta para sostener ese trato -qué se autorizó, a
 * qué precio, cuándo será el cobro y cómo cancelarlo- queda en un mandato
 * guardado, porque un cobro sin mandato demostrable es un cargo no autorizado.
 *
 * El cobro se apoya en la conciliación que ya existe para el checkout: se crea
 * un `Payment` con la misma forma que un pago normal y el webhook de Wompi lo
 * activa. Un `PENDING` no concede acceso; solo lo hace un `APPROVED`
 * confirmado por consulta a Wompi.
 */

export const TRIAL_DAYS = 7;
export const TRIAL_PLANS: WompiPlanId[] = ['STANDARD', 'PREMIUM'];
/** Se sube cuando cambia el texto del mandato. Queda grabado en cada aceptación. */
export const MANDATE_CONSENT_VERSION = '2026-09-20';
/** Intentos de cobro antes de dar el periodo por perdido. */
export const MAX_CHARGE_ATTEMPTS = 3;
/** Espera entre reintentos tras un rechazo. */
export const RETRY_DELAY_HOURS = 24;

export class TrialError extends Error {
  readonly status: number;
  constructor(
    readonly code:
      | 'PLAN_NOT_ELIGIBLE'
      | 'ALREADY_SUBSCRIBED'
      | 'TRIAL_ALREADY_USED'
      | 'NO_TRIAL_ACTIVE'
      | 'NOT_CONFIGURED'
      /** El banco no autorizó el cobro de validación. La tarjeta no sirve. */
      | 'CARD_NOT_VERIFIED',
    message: string,
    status = 409,
  ) {
    super(message);
    this.name = 'TrialError';
    this.status = status;
  }
}

export function trialPaymentsConfigured(): boolean {
  if (process.env.BILLING_PROVIDER !== 'wompi') return false;
  try { return Boolean(readWompiConfig(process.env, { requireIntegrity: true, requireEvents: true }).privateKey); }
  catch { return false; }
}

// ── Precio ──────────────────────────────────────────────────────────────────

interface TrialPricing {
  amountInCents: number;
  usdCents: number;
  pricingMode: 'fixed_cop' | 'usd_trm';
  quoteTag: string;
}

/**
 * Importe en centavos de COP del primer cobro.
 *
 * Se resuelve al aceptar el mandato y se anuncia entonces, no en el momento del
 * cobro: nadie debe descubrir el precio cuando ya se lo han cobrado. Si la TRM
 * se mueve durante la prueba, el cobro usa la tasa vigente ese día, y así queda
 * declarado en el texto que se acepta.
 */
export async function trialPricing(planId: WompiPlanId, interval: WompiInterval): Promise<TrialPricing> {
  const mode = (process.env.WOMPI_PRICING_MODE ?? 'fixed_cop') as 'fixed_cop' | 'usd_trm';
  const plan = PLAN_ENTITLEMENTS[planId];
  const usdCents = Math.round((interval === 'YEARLY' ? plan.priceYearlyUsd : plan.priceMonthlyUsd) * 100);

  if (mode === 'usd_trm') {
    const rate = await currentTrm();
    const quote = { ...rate, usdAmountInCents: usdCents };
    return {
      amountInCents: convertUsdToCopCents(usdCents, rate.rateHundredths),
      usdCents,
      pricingMode: 'usd_trm',
      quoteTag: exchangeQuoteTag(quote),
    };
  }

  return {
    amountInCents: wompiAmountInCents(planId, interval),
    usdCents,
    pricingMode: 'fixed_cop',
    quoteTag: '',
  };
}

// ── Mandato ─────────────────────────────────────────────────────────────────

/**
 * Texto íntegro que la persona acepta. Se guarda tal cual junto al mandato:
 * poder demostrar *qué* se autorizó importa más que poder demostrar que se
 * pulsó un botón.
 */
export function mandateText(params: {
  planId: WompiPlanId;
  interval: WompiInterval;
  trialDays: number;
  firstChargeAt: Date;
  usdCents: number;
  pricingMode: 'fixed_cop' | 'usd_trm';
}): string {
  const plan = PLAN_ENTITLEMENTS[params.planId];
  const cadence = params.interval === 'YEARLY' ? 'anual' : 'mensual';
  const price = (params.usdCents / 100).toFixed(2);
  const fecha = params.firstChargeAt.toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const conversion =
    params.pricingMode === 'usd_trm'
      ? ' El cobro se hace en pesos colombianos, convertidos con la TRM vigente el día del cobro.'
      : ' El cobro se hace en pesos colombianos al importe fijo publicado.';

  return [
    `Autorizo a TradingLab a guardar mi tarjeta y a cobrarla de forma ${cadence} por el plan ${plan.name}, a USD ${price} por periodo.${conversion}`,
    `La membresía no se cobra durante los primeros ${params.trialDays} días. Para validar la tarjeta se solicita un cargo de COP 1.500 y su anulación; el banco determina cuándo libera el importe. El primer cobro del plan será el ${fecha}.`,
    'Puedo cancelar en cualquier momento desde Facturación. Si cancelo antes del primer cobro del plan, no se cobra la membresía y conservo el acceso hasta que termine la prueba.',
    'TradingLab es una plataforma educativa y de simulación: el pago da acceso a contenido y herramientas de práctica, nunca a la gestión de dinero real.',
  ].join(' ');
}

// ── Elegibilidad ────────────────────────────────────────────────────────────

export interface TrialEligibility {
  eligible: boolean;
  reason: 'OK' | 'ALREADY_SUBSCRIBED' | 'TRIAL_ALREADY_USED';
  detail: string | null;
}

/**
 * Una prueba por cuenta y solo si no hay periodo vigente.
 *
 * Se comprueba contra el histórico de mandatos, no contra la suscripción
 * actual: cancelar y volver a empezar no puede regalar pruebas encadenadas.
 */
export async function trialEligibility(userId: string, now = new Date()): Promise<TrialEligibility> {
  const [subscription, previousMandate] = await Promise.all([
    db.subscription.findUnique({ where: { userId } }),
    db.billingMandate.findFirst({ where: { userId }, select: { id: true } }),
  ]);

  if (
    subscription &&
    ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(subscription.status) &&
    subscription.currentPeriodEnd > now
  ) {
    return {
      eligible: false,
      reason: 'ALREADY_SUBSCRIBED',
      detail: 'Ya tienes un periodo activo.',
    };
  }
  if (previousMandate) {
    return {
      eligible: false,
      reason: 'TRIAL_ALREADY_USED',
      detail: 'Esta cuenta ya usó su prueba gratuita.',
    };
  }
  return { eligible: true, reason: 'OK', detail: null };
}

// ── Alta de la prueba ───────────────────────────────────────────────────────

export interface StartTrialResult {
  planId: WompiPlanId;
  interval: WompiInterval;
  trialEndsAt: Date;
  verificationVoided: boolean;
  firstChargeAt: Date;
  amountInCents: number;
  card: { brand: string | null; lastFour: string | null };
}

export async function startTrial(params: {
  userId: string;
  email: string;
  planId: WompiPlanId;
  interval: WompiInterval;
  cardToken: string;
  acceptanceToken: string;
  personalDataToken: string;
  /** Vencimiento, solo para que la persona reconozca su tarjeta en
   *  Facturación y podamos avisarle antes de que caduque. No participa en
   *  ningún cobro: quien cobra es Wompi con su fuente de pago. */
  expMonth?: string | null;
  expYear?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  now?: Date;
}): Promise<StartTrialResult> {
  if (!TRIAL_PLANS.includes(params.planId)) {
    throw new TrialError('PLAN_NOT_ELIGIBLE', 'Este plan no tiene prueba gratuita.', 400);
  }

  if (process.env.BILLING_PROVIDER !== 'wompi') {
    throw new TrialError('NOT_CONFIGURED', 'Las pruebas con tarjeta requieren Wompi activo.', 503);
  }
  const now = params.now ?? new Date();
  const eligibility = await trialEligibility(params.userId, now);
  if (!eligibility.eligible) {
    throw new TrialError(
      eligibility.reason === 'ALREADY_SUBSCRIBED' ? 'ALREADY_SUBSCRIBED' : 'TRIAL_ALREADY_USED',
      eligibility.detail ?? 'No puedes iniciar una prueba ahora.',
    );
  }

  const config = readWompiConfig(process.env, { requireIntegrity: true, requireEvents: true });
  const pricing = await trialPricing(params.planId, params.interval);
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86_400_000);

  // La tarjeta se guarda antes de tocar nada nuestro: si el banco la rechaza,
  // no queda una suscripción a medias esperando un cobro imposible.
  const source = await createPaymentSource({
    cardToken: params.cardToken,
    acceptanceToken: params.acceptanceToken,
    personalDataToken: params.personalDataToken,
    email: params.email,
  });

  /**
   * Y guardarla tampoco demuestra que se le pueda cobrar.
   *
   * Wompi acepta cualquier token válido y deja la fuente en `AVAILABLE` sin
   * preguntarle nada al banco emisor: una tarjeta sin fondos, bloqueada para
   * comercio electrónico o de prueba pasa ese filtro igual que una buena. Sin
   * este paso, el primer cobro real llegaba siete días después -con el acceso
   * ya regalado y la persona ya ida-, y era entonces cuando se descubría.
   *
   * Se cobra el mínimo que Wompi acepta y se anula acto seguido. La persona ve
   * una retención pequeña que desaparece en unas horas; nosotros sabemos que la
   * tarjeta responde antes de dar nada.
   */
  const reference = wompiReference(params.userId, `verify-${randomBytes(12).toString('hex')}`, config.integritySecret);
  const attempt = await db.$transaction(async tx => {
    await tx.user.update({ where: { id: params.userId }, data: { updatedAt: new Date() } });
    const unresolved = await tx.auditLog.findFirst({ where: { actorId: params.userId, entity: 'WOMPI_VERIFICATION', action: { in: ['PENDING', 'REVIEW_REQUIRED'] } } });
    const used = await tx.billingMandate.findFirst({ where: { userId: params.userId }, select: { id: true } });
    if (unresolved || used) throw new TrialError('CARD_NOT_VERIFIED', 'Ya existe una prueba o validación pendiente. Revisa Facturación o contacta con soporte antes de reintentar.', 409);
    return tx.auditLog.create({ data: { actorId: params.userId, entity: 'WOMPI_VERIFICATION', entityId: reference, action: 'PENDING', diff: JSON.stringify({ environment: config.environment, amountInCents: CARD_VERIFICATION_AMOUNT_IN_CENTS, paymentSourceId: source.wompiId }) } });
  });
  let verification;
  try {
    verification = await verifyPaymentSource({
    paymentSourceId: source.wompiId,
    email: params.email,
    reference,
    onTransaction: async id => { await db.auditLog.update({ where: { id: attempt.id }, data: { diff: JSON.stringify({ environment: config.environment, transactionId: id, reference, amountInCents: CARD_VERIFICATION_AMOUNT_IN_CENTS }) } }); },
    });
    await db.auditLog.update({ where: { id: attempt.id }, data: { action: verification.status === 'PENDING' || (verification.verified && !verification.voided) ? 'REVIEW_REQUIRED' : verification.verified ? 'PENDING' : 'RESOLVED', diff: JSON.stringify({ environment: config.environment, reference, ...verification }) } });
  } catch (error) {
    await db.auditLog.update({ where: { id: attempt.id }, data: { action: 'REVIEW_REQUIRED' } });
    throw error;
  }
  if (verification.status === 'PENDING') {
    throw new TrialError('CARD_NOT_VERIFIED', `La validación sigue pendiente en Wompi. No se activó la prueba. Contacta con soporte antes de reintentar. Referencia: ${verification.transactionId}`, 409);
  }
  if (!verification.verified) {
    throw new TrialError(
      'CARD_NOT_VERIFIED',
      verification.statusMessage
        ? `Tu banco no autorizó la validación de la tarjeta: ${verification.statusMessage}`
        : 'Tu banco no autorizó la validación de la tarjeta. Prueba con otra o consulta con tu banco.',
      402,
    );
  }

  const consentText = mandateText({
    planId: params.planId,
    interval: params.interval,
    trialDays: TRIAL_DAYS,
    firstChargeAt: trialEndsAt,
    usdCents: pricing.usdCents,
    pricingMode: pricing.pricingMode,
  });

  await db.$transaction(async (tx) => {
    // Serialize entitlement grants across concurrent requests and instances.
    await tx.user.update({ where: { id: params.userId }, data: { updatedAt: new Date() } });
    const prior = await tx.billingMandate.findFirst({ where: { userId: params.userId }, select: { id: true } });
    const active = await tx.subscription.findUnique({ where: { userId: params.userId } });
    if (prior || (active && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(active.status) && active.currentPeriodEnd > new Date())) {
      throw new TrialError('TRIAL_ALREADY_USED', 'La cuenta ya tiene un periodo o una prueba. Revisa Facturación.');
    }
    const owner = await tx.paymentSource.findUnique({ where: { wompiId_environment: { wompiId: source.wompiId, environment: source.environment } } });
    if (owner && owner.userId !== params.userId) throw new TrialError('CARD_NOT_VERIFIED', 'No se pudo vincular esta tarjeta.', 409);
    const paymentSource = await tx.paymentSource.upsert({
      where: { wompiId_environment: { wompiId: source.wompiId, environment: source.environment } },
      create: {
        userId: params.userId,
        wompiId: source.wompiId,
        environment: source.environment,
        brand: source.brand,
        lastFour: source.lastFour,
        expMonth: params.expMonth ?? null,
        expYear: params.expYear ?? null,
      },
      update: { status: 'ACTIVE' },
    });

    if (verification.voided) await tx.auditLog.update({ where: { id: attempt.id }, data: { action: 'RESOLVED' } });
    await tx.billingMandate.create({
      data: {
        userId: params.userId,
        paymentSourceId: paymentSource.id,
        verificationTransactionId: verification.transactionId,
        verificationAmountCents: verification.amountInCents,
        verificationVoided: verification.voided,
        planId: params.planId,
        interval: params.interval,
        priceUsdCents: pricing.usdCents,
        pricingMode: pricing.pricingMode,
        trialDays: TRIAL_DAYS,
        firstChargeAt: trialEndsAt,
        consentVersion: MANDATE_CONSENT_VERSION,
        consentText,
        ipHash: params.ipHash ?? null,
        userAgent: params.userAgent?.slice(0, 300) ?? null,
      },
    });

    await tx.subscription.upsert({
      where: { userId: params.userId },
      create: {
        userId: params.userId,
        planId: params.planId,
        status: 'TRIALING',
        interval: params.interval,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
        source: 'TRIAL',
        paymentSourceId: paymentSource.id,
        nextChargeAt: trialEndsAt,
        chargeAttempts: 0,
        lastChargeError: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      update: {
        planId: params.planId,
        status: 'TRIALING',
        interval: params.interval,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
        source: 'TRIAL',
        paymentSourceId: paymentSource.id,
        nextChargeAt: trialEndsAt,
        chargeAttempts: 0,
        lastChargeError: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        couponCode: null,
        externalId: null,
      },
    });

    await tx.notification.create({
      data: {
        userId: params.userId,
        kind: 'INFO',
        title: `Prueba de ${PLAN_ENTITLEMENTS[params.planId].name} iniciada`,
        body: `Tienes ${TRIAL_DAYS} días gratis. El primer cobro será el ${trialEndsAt.toLocaleDateString('es')} y puedes cancelar antes sin coste desde Facturación.`,
        href: '/billing',
      },
    });
  });

  await track(
    ANALYTICS_EVENTS.TRIAL_STARTED,
    { planId: params.planId, interval: params.interval, environment: config.environment },
    { userId: params.userId },
  );

  return {
    planId: params.planId,
    interval: params.interval,
    trialEndsAt,
    verificationVoided: verification.voided,
    firstChargeAt: trialEndsAt,
    amountInCents: pricing.amountInCents,
    card: { brand: source.brand, lastFour: source.lastFour },
  };
}

// ── Cancelación ─────────────────────────────────────────────────────────────

/**
 * Cancela el mandato.
 *
 * Se conserva el acceso hasta el final del periodo ya concedido: la persona no
 * pierde días que le corresponden por cancelar a tiempo, y esa es justamente la
 * conducta que queremos que sea fácil.
 */
export async function cancelTrial(params: {
  userId: string;
  reason?: string;
  now?: Date;
}): Promise<{ accessUntil: Date; charged: false }> {
  const now = params.now ?? new Date();
  const subscription = await db.subscription.findUnique({ where: { userId: params.userId } });

  if (!subscription || subscription.source !== 'TRIAL' || !subscription.nextChargeAt) {
    throw new TrialError('NO_TRIAL_ACTIVE', 'No hay ninguna prueba con cobro programado en esta cuenta.', 404);
  }

  await db.$transaction(async (tx) => {
    await tx.billingMandate.updateMany({
      where: { userId: params.userId, revokedAt: null },
      data: { revokedAt: now, revokedReason: params.reason?.slice(0, 300) ?? 'Cancelada por la persona usuaria.' },
    });
    await tx.subscription.update({
      where: { userId: params.userId },
      data: {
        // Sin próxima fecha de cobro no hay nada que cobrar: es el interruptor.
        nextChargeAt: null,
        cancelAtPeriodEnd: true,
        canceledAt: now,
      },
    });
    await tx.notification.create({
      data: {
        userId: params.userId,
        kind: 'INFO',
        title: 'Prueba cancelada, sin cobro',
        body: `No se te cobrará nada. Conservas el acceso hasta el ${subscription.currentPeriodEnd.toLocaleDateString('es')}.`,
        href: '/billing',
      },
    });
  });

  await track(ANALYTICS_EVENTS.SUBSCRIPTION_CANCELED, { duringTrial: true }, { userId: params.userId });

  return { accessUntil: subscription.currentPeriodEnd, charged: false };
}

// ── Cobro programado ────────────────────────────────────────────────────────

export interface ChargeRunReport {
  due: number;
  submitted: number;
  declined: number;
  skipped: number;
  errors: number;
}

/** Referencia única e irrepetible por intento. Wompi rechaza una repetida. */
function chargeReference(): string {
  return `tl_r_${Date.now().toString(36)}${randomBytes(8).toString('hex')}`;
}

/**
 * Cobra las suscripciones cuya fecha de cobro ha llegado.
 *
 * No concede acceso: crea el `Payment` en PENDING y deja que la conciliación
 * habitual —la que ya usa el checkout, con consulta a Wompi y firma verificada—
 * lo active cuando la transacción quede aprobada. Adelantarse aquí sería
 * regalar un periodo por una transacción que todavía puede acabar rechazada.
 */
export async function chargeDueSubscriptions(now = new Date()): Promise<ChargeRunReport> {
  const report: ChargeRunReport = { due: 0, submitted: 0, declined: 0, skipped: 0, errors: 0 };

  const due = await db.subscription.findMany({
    where: {
      nextChargeAt: { not: null, lte: now },
      status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] },
      chargeAttempts: { lt: MAX_CHARGE_ATTEMPTS },
    },
    include: {
      user: { select: { id: true, email: true, status: true } },
      paymentSource: true,
    },
  });

  report.due = due.length;

  for (const subscription of due) {
    // Un mandato revocado no autoriza nada, aunque quede una fecha por limpiar.
    const mandate = await db.billingMandate.findFirst({
      where: { userId: subscription.userId, revokedAt: null },
      orderBy: { acceptedAt: 'desc' },
    });

    if (
      !mandate ||
      !subscription.paymentSource ||
      subscription.paymentSource.status !== 'ACTIVE' ||
      subscription.user.status !== 'ACTIVE'
    ) {
      report.skipped++;
      await db.subscription.update({ where: { userId: subscription.userId }, data: { nextChargeAt: null } });
      continue;
    }

    const planId = subscription.planId as WompiPlanId;
    const interval = subscription.interval as WompiInterval;

    let submittedToWompi = false;
    try {
      const config = readWompiConfig();
      if (subscription.paymentSource.environment !== config.environment) throw new TrialError('NOT_CONFIGURED', 'La tarjeta guardada pertenece a otro ambiente.', 503);
      const pricing = await trialPricing(planId, interval);
      const reference = chargeReference();
      const idempotencyKey = wompiPaymentIdempotencyKey(reference);

      // El Payment se crea ANTES de llamar a Wompi. Si la llamada se pierde por
      // red, queda el rastro para conciliar por webhook en lugar de un cobro
      // huérfano que nadie sabe a quién pertenece.
      const claimed = await db.$transaction(async tx => {
        const claim = await tx.subscription.updateMany({
          where: { userId: subscription.userId, nextChargeAt: subscription.nextChargeAt, cancelAtPeriodEnd: false },
          data: { nextChargeAt: null },
        });
        if (claim.count !== 1) return false;
        await tx.payment.create({
        data: {
          userId: subscription.userId,
          amountCents: pricing.amountInCents,
          currency: 'COP',
          status: 'PENDING',
          description: `${wompiPaymentDescription(planId, interval)}${pricing.quoteTag}`,
          idempotencyKey,
        },
        });
        return true;
      });
      if (!claimed) { report.skipped++; continue; }
      submittedToWompi = true;
      const charge = await chargePaymentSource({
        paymentSourceId: subscription.paymentSource.wompiId,
        amountInCents: pricing.amountInCents,
        reference,
        email: subscription.user.email,
      });

      if (charge.status === 'DECLINED' || charge.status === 'ERROR' || charge.status === 'VOIDED') {
        report.declined++;
        await onChargeFailed(subscription.userId, subscription.chargeAttempts, charge.statusMessage, now);
        await db.payment.update({ where: { idempotencyKey }, data: { status: 'FAILED', externalId: charge.transactionId } });
        continue;
      }

      // PENDING o APPROVED: la transacción existe. La activación la hará la
      // conciliación al confirmarla contra Wompi.
      report.submitted++;
      await db.subscription.update({
        where: { userId: subscription.userId },
        data: {
          externalId: charge.transactionId,
          // Se retira la fecha para que otra ejecución del programador no
          // vuelva a cobrar mientras esta transacción se resuelve.
          nextChargeAt: null,
          lastChargeError: null,
        },
      });
      await db.payment.update({ where: { idempotencyKey }, data: { externalId: charge.transactionId } });
    } catch (error) {
      report.errors++;
      const message = error instanceof WompiError ? error.message : 'No pudimos procesar el cobro.';
      if (submittedToWompi) {
        // An uncertain network result is not a bank rejection. Do not charge again.
        await db.subscription.update({ where: { userId: subscription.userId }, data: { nextChargeAt: null, lastChargeError: 'Resultado pendiente de conciliación con Wompi. No se repetirá el cobro automáticamente.' } });
      } else await onChargeFailed(subscription.userId, subscription.chargeAttempts, message, now);
    }
  }

  return report;
}

async function onChargeFailed(
  userId: string,
  attempts: number,
  message: string | null,
  now: Date,
): Promise<void> {
  const next = attempts + 1;
  const exhausted = next >= MAX_CHARGE_ATTEMPTS;

  await db.subscription.update({
    where: { userId },
    data: {
      status: 'PAST_DUE',
      chargeAttempts: next,
      lastChargeError: message?.slice(0, 300) ?? null,
      nextChargeAt: exhausted ? null : new Date(now.getTime() + RETRY_DELAY_HOURS * 3_600_000),
    },
  });

  await db.notification.create({
    data: {
      userId,
      kind: 'WARNING',
      title: exhausted ? 'No pudimos cobrar tu suscripción' : 'Tu banco rechazó el cobro',
      body: exhausted
        ? 'Hemos dejado de intentarlo. Actualiza tu tarjeta en Facturación para recuperar el acceso.'
        : `Volveremos a intentarlo en ${RETRY_DELAY_HOURS} horas. Puedes actualizar tu tarjeta en Facturación.`,
      href: '/billing',
    },
  });
}

// ── Vista de facturación ────────────────────────────────────────────────────

export interface BillingOverview {
  plan: PlanId;
  status: string;
  source: string;
  interval: WompiInterval | null;
  /** Días completos que faltan para que termine la prueba. */
  trialDaysLeft: number | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  nextChargeAt: Date | null;
  nextChargeAmountUsdCents: number | null;
  canceledAt: Date | null;
  lastChargeError: string | null;
  card: { brand: string | null; lastFour: string | null; expMonth: string | null; expYear: string | null } | null;
  mandate: { acceptedAt: Date; consentVersion: string; consentText: string; revokedAt: Date | null } | null;
  eligibility: TrialEligibility;
}

/** Todo lo que la página de facturación necesita, resuelto en el servidor. */
export async function billingOverview(userId: string, now = new Date()): Promise<BillingOverview> {
  const [subscription, mandate, eligibility] = await Promise.all([
    db.subscription.findUnique({ where: { userId }, include: { paymentSource: true } }),
    db.billingMandate.findFirst({ where: { userId }, orderBy: { acceptedAt: 'desc' } }),
    trialEligibility(userId, now),
  ]);

  const trialEndsAt = subscription?.trialEndsAt ?? null;
  const trialing = subscription?.status === 'TRIALING' && trialEndsAt !== null && trialEndsAt > now;

  return {
    plan: (subscription?.planId as PlanId) ?? 'FREE',
    status: subscription?.status ?? 'NONE',
    source: subscription?.source ?? 'NONE',
    interval: (subscription?.interval as WompiInterval) ?? null,
    trialDaysLeft: trialing ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000)) : null,
    trialEndsAt,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    nextChargeAt: subscription?.nextChargeAt ?? null,
    nextChargeAmountUsdCents: mandate && !mandate.revokedAt ? mandate.priceUsdCents : null,
    canceledAt: subscription?.canceledAt ?? null,
    lastChargeError: subscription?.lastChargeError ?? null,
    card: subscription?.paymentSource
      ? {
          brand: subscription.paymentSource.brand,
          lastFour: subscription.paymentSource.lastFour,
          expMonth: subscription.paymentSource.expMonth,
          expYear: subscription.paymentSource.expYear,
        }
      : null,
    mandate: mandate
      ? {
          acceptedAt: mandate.acceptedAt,
          consentVersion: mandate.consentVersion,
          consentText: mandate.consentText,
          revokedAt: mandate.revokedAt,
        }
      : null,
    eligibility,
  };
}
