import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, handleError, ok, clientIp } from '@/lib/api';
import { requireAuth, hashIp } from '@/lib/auth';
import { isSameOriginRequest } from '@/lib/request-origin';
import { acceptanceTokens } from '@/lib/wompi-recurring';
import {
  MANDATE_CONSENT_VERSION,
  TRIAL_DAYS,
  TRIAL_PLANS,
  cancelTrial,
  mandateText,
  startTrial,
  trialEligibility,
  trialPricing,
  TrialError,
} from '@/lib/trials';
import { WompiError, type WompiInterval, type WompiPlanId } from '@/lib/wompi';

const startSchema = z
  .object({
    planId: z.enum(['STANDARD', 'PREMIUM']),
    interval: z.enum(['MONTHLY', 'YEARLY']),
    // Token de un solo uso emitido por Wompi al navegador. Nunca un PAN.
    cardToken: z.string().trim().min(10).max(200).regex(/^tok_/, 'Token de tarjeta no válido.'),
    acceptanceToken: z.string().trim().min(20).max(4000),
    personalDataToken: z.string().trim().min(20).max(4000),
    /** Confirmación explícita del mandato. No puede venir preseleccionada. */
    acceptMandate: z.literal(true),
    consentVersion: z.string().trim().max(40),
  })
  .strict();

const cancelSchema = z.object({ reason: z.string().trim().max(300).optional() }).strict();

/**
 * Datos para pintar el formulario: tokens de aceptación, precio anunciado y el
 * texto exacto del mandato que se va a aceptar. El precio se calcula aquí y no
 * en el cliente: un importe que viene del navegador no es un precio, es una
 * sugerencia.
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const planId = (req.nextUrl.searchParams.get('plan') ?? 'PREMIUM') as WompiPlanId;
    const interval = (req.nextUrl.searchParams.get('interval') ?? 'MONTHLY') as WompiInterval;
    if (!TRIAL_PLANS.includes(planId) || !['MONTHLY', 'YEARLY'].includes(interval)) {
      return fail('INVALID_PLAN', 'Ese plan no tiene prueba gratuita.', 400);
    }

    const eligibility = await trialEligibility(user.id);
    if (!eligibility.eligible) {
      return ok({ eligible: false, reason: eligibility.reason, detail: eligibility.detail });
    }

    const [tokens, pricing] = await Promise.all([acceptanceTokens(), trialPricing(planId, interval)]);
    const firstChargeAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);

    return ok({
      eligible: true,
      trialDays: TRIAL_DAYS,
      firstChargeAt: firstChargeAt.toISOString(),
      amountInCents: pricing.amountInCents,
      usdCents: pricing.usdCents,
      pricingMode: pricing.pricingMode,
      consentVersion: MANDATE_CONSENT_VERSION,
      consentText: mandateText({
        planId,
        interval,
        trialDays: TRIAL_DAYS,
        firstChargeAt,
        usdCents: pricing.usdCents,
        pricingMode: pricing.pricingMode,
      }),
      // La llave pública es pública por definición: con ella el navegador
      // tokeniza sin que la tarjeta pase por nuestro servidor.
      publicKey: tokens.publicKey,
      tokenizationUrl: tokens.tokenizationUrl,
      environment: tokens.environment,
      acceptanceToken: tokens.termsToken,
      acceptanceUrl: tokens.termsUrl,
      personalDataToken: tokens.personalDataToken,
      personalDataUrl: tokens.personalDataUrl,
    });
  } catch (error) {
    if (error instanceof WompiError) return fail(error.code, error.message, error.status);
    return handleError(error);
  }
}

/** Inicia la prueba: guarda la tarjeta, registra el mandato y abre el periodo. */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    if (!isSameOriginRequest(req)) {
      return fail('CROSS_SITE_REQUEST', 'No pudimos validar el origen de la solicitud.', 403);
    }
    const input = startSchema.parse(await req.json());
    if (input.consentVersion !== MANDATE_CONSENT_VERSION) {
      // El texto cambió mientras la persona lo leía: se rehace, no se asume.
      return fail('CONSENT_OUTDATED', 'Las condiciones se actualizaron. Vuelve a revisarlas antes de continuar.', 409);
    }

    const result = await startTrial({
      userId: user.id,
      email: user.email,
      planId: input.planId,
      interval: input.interval,
      cardToken: input.cardToken,
      acceptanceToken: input.acceptanceToken,
      personalDataToken: input.personalDataToken,
      ipHash: hashIp(clientIp(req)),
      userAgent: req.headers.get('user-agent'),
    });

    return ok({
      planId: result.planId,
      trialEndsAt: result.trialEndsAt.toISOString(),
      firstChargeAt: result.firstChargeAt.toISOString(),
      amountInCents: result.amountInCents,
      card: result.card,
    });
  } catch (error) {
    if (error instanceof TrialError) return fail(error.code, error.message, error.status);
    if (error instanceof WompiError) return fail(error.code, error.message, error.status);
    return handleError(error);
  }
}

/** Cancela el mandato. Conserva el acceso ya concedido y no cobra nada. */
export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    if (!isSameOriginRequest(req)) {
      return fail('CROSS_SITE_REQUEST', 'No pudimos validar el origen de la solicitud.', 403);
    }
    let reason: string | undefined;
    try {
      reason = cancelSchema.parse(await req.json()).reason;
    } catch {
      reason = undefined;
    }
    const result = await cancelTrial({ userId: user.id, reason });
    return ok({ accessUntil: result.accessUntil.toISOString(), charged: result.charged });
  } catch (error) {
    if (error instanceof TrialError) return fail(error.code, error.message, error.status);
    return handleError(error);
  }
}
