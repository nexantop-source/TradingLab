import { NextRequest } from 'next/server';
import { z } from 'zod';
import { clientIp, detectDevice, fail, handleError, ok } from '@/lib/api';
import { getAuth } from '@/lib/auth';
import { enforce, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';
import {
  AD_SLOT_BY_CODE,
  accruedCpmCents,
  isForbiddenSurface,
} from '@tl/ads';
import {
  adEventSecretConfigured,
  adViewerBinding,
  claimAdEventOnce,
  releaseAdEventClaim,
  verifyAdEventToken,
} from '@/components/ads/ad-event-security';

const MAX_EVENT_BYTES = 8 * 1024;

const eventSchema = z
  .object({
    creativeId: z.string().trim().min(1).max(100),
    campaignId: z.string().trim().min(1).max(100),
    slotCode: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/),
    type: z.enum(['IMPRESSION', 'CLICK', 'VIEWABLE']),
    page: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9/_-]+$/),
    eventToken: z.string().min(80).max(4096),
    impressionId: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

function viewerSource(req: NextRequest, auth: Awaited<ReturnType<typeof getAuth>>): string {
  return auth
    ? `user:${auth.user.id}:session:${auth.sessionId}`
    : `anon:${clientIp(req) ?? 'unknown'}:ua:${req.headers.get('user-agent') ?? 'unknown'}`;
}

function sameOrigin(req: NextRequest): boolean {
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return false;
  const origin = req.headers.get('origin');
  return !origin || origin === req.nextUrl.origin;
}

/**
 * Registro autenticado de impresiones, viewability y clics. El navegador no
 * puede elegir campaña/creatividad: todos esos campos quedan ligados al recibo
 * HMAC emitido por `/api/ads/serve`.
 */
export async function POST(req: NextRequest) {
  let replayKey: string | null = null;
  let persistSucceeded = false;

  try {
    if (!sameOrigin(req)) return fail('INVALID_AD_EVENT', 'Evento publicitario no válido.', 403);
    const provider = (
      process.env.ADS_PROVIDER ?? (process.env.NODE_ENV === 'production' ? 'off' : 'internal')
    )
      .trim()
      .toLowerCase();
    if (provider !== 'internal') {
      return ok({ recorded: false, reason: 'INTERNAL_PROVIDER_DISABLED' });
    }
    if (!adEventSecretConfigured()) {
      return fail('ADS_NOT_CONFIGURED', 'La medición publicitaria no está configurada.', 503);
    }
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return fail('UNSUPPORTED_MEDIA_TYPE', 'El evento debe enviarse como JSON.', 415);
    }

    const contentLength = Number(req.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_EVENT_BYTES) {
      return fail('PAYLOAD_TOO_LARGE', 'El evento publicitario supera el tamaño permitido.', 413);
    }

    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_EVENT_BYTES) {
      return fail('PAYLOAD_TOO_LARGE', 'El evento publicitario supera el tamaño permitido.', 413);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fail('VALIDATION_ERROR', 'El evento publicitario no contiene JSON válido.', 422);
    }
    const input = eventSchema.parse(parsed);
    const auth = await getAuth();

    // También se revalida el plan al registrar: una sesión Premium no produce
    // telemetría ni gasto, aunque conserve un recibo antiguo en otra pestaña.
    if (auth && auth.user.plan !== 'FREE') return ok({ recorded: false, reason: 'PLAN_NO_ADS' });

    await enforce(`adevent:${auth?.user.id ?? clientIp(req) ?? 'anon'}`, RATE_LIMITS.adEvent);

    const descriptor = AD_SLOT_BY_CODE.get(input.slotCode);
    if (!descriptor || isForbiddenSurface(descriptor.surface) || isForbiddenSurface(input.page)) {
      return ok({ recorded: false, reason: 'FORBIDDEN_OR_UNKNOWN_SLOT' });
    }

    const secret = process.env.ADS_EVENT_TOKEN_SECRET as string;
    const viewer = await adViewerBinding(secret, viewerSource(req, auth));
    const claims = await verifyAdEventToken(secret, input.eventToken, viewer);
    if (
      !claims ||
      claims.creativeId !== input.creativeId ||
      claims.campaignId !== input.campaignId ||
      claims.slotCode !== input.slotCode ||
      claims.page !== input.page
    ) {
      return fail('INVALID_AD_EVENT', 'Evento publicitario no válido.', 401);
    }

    replayKey = `${claims.jti}:${input.type}`;
    if (!claimAdEventOnce(replayKey, claims.exp)) {
      return ok({ recorded: false, duplicate: true });
    }

    const creative = await db.creative.findUnique({
      where: { id: claims.creativeId },
      include: {
        placement: { include: { adUnit: true } },
        campaign: { include: { advertiser: true } },
      },
    });
    const now = new Date();
    if (
      !creative ||
      creative.campaignId !== claims.campaignId ||
      creative.reviewStatus !== 'APPROVED' ||
      !creative.placement.active ||
      !creative.placement.adUnit.active ||
      creative.placement.adUnitId !== claims.slotCode ||
      creative.placement.page !== claims.page ||
      creative.campaign.status !== 'ACTIVE' ||
      creative.campaign.advertiser.status !== 'APPROVED' ||
      creative.campaign.startsAt > now ||
      (creative.campaign.endsAt != null && creative.campaign.endsAt < now)
    ) {
      persistSucceeded = true;
      return ok({ recorded: false, reason: 'CREATIVE_NOT_ELIGIBLE' });
    }

    const userId = auth?.user.id ?? null;
    const day = now.toISOString().slice(0, 10);
    const device = detectDevice(req.headers.get('user-agent'));

    if (input.type === 'IMPRESSION') {
      const impressionId = await db.$transaction(async (tx) => {
        const impression = await tx.adImpression.create({
          data: {
            creativeId: claims.creativeId,
            campaignId: claims.campaignId,
            userId,
            slotCode: claims.slotCode,
            page: claims.page,
            device,
            day,
          },
          select: { id: true },
        });

        if (creative.campaign.pricingModel === 'CPM') {
          // Se acumula el coste exacto y solo se redondea el total a centavos;
          // nunca cada impresión individual (que duplicaba CPM bajos).
          const totalImpressions = await tx.adImpression.count({
            where: { campaignId: creative.campaign.id },
          });
          const accrued = accruedCpmCents(
            totalImpressions,
            creative.campaign.unitPriceCents,
            creative.campaign.budgetCents,
          );
          await tx.adCampaign.updateMany({
            where: { id: creative.campaign.id, spentCents: { lt: accrued } },
            data: { spentCents: accrued },
          });
        }

        return impression.id;
      });

      persistSucceeded = true;
      await track(ANALYTICS_EVENTS.AD_IMPRESSION, { slot: claims.slotCode, page: claims.page }, { userId });
      return ok({ recorded: true, impressionId });
    }

    if (input.type === 'VIEWABLE') {
      if (!input.impressionId) {
        persistSucceeded = true;
        return ok({ recorded: false, reason: 'IMPRESSION_REQUIRED' });
      }
      const updated = await db.adImpression.updateMany({
        where: {
          id: input.impressionId,
          creativeId: claims.creativeId,
          campaignId: claims.campaignId,
          userId,
          slotCode: claims.slotCode,
          page: claims.page,
          createdAt: { gte: new Date(claims.iat - 5_000) },
          viewable: false,
        },
        data: { viewable: true },
      });
      persistSucceeded = true;
      return ok({ recorded: updated.count === 1 });
    }

    await db.$transaction(async (tx) => {
      await tx.adClick.create({
        data: {
          creativeId: claims.creativeId,
          campaignId: claims.campaignId,
          userId,
          slotCode: claims.slotCode,
        },
      });
      if (creative.campaign.pricingModel === 'CPC') {
        const increment = Math.min(
          creative.campaign.unitPriceCents,
          Math.max(0, creative.campaign.budgetCents - creative.campaign.spentCents),
        );
        if (increment > 0) {
          await tx.adCampaign.updateMany({
            where: {
              id: creative.campaign.id,
              spentCents: { lte: creative.campaign.budgetCents - increment },
            },
            data: { spentCents: { increment } },
          });
        }
      }
    });
    persistSucceeded = true;
    await track(ANALYTICS_EVENTS.AD_CLICK, { slot: claims.slotCode }, { userId });
    return ok({ recorded: true });
  } catch (error) {
    if (replayKey && !persistSucceeded) releaseAdEventClaim(replayKey);
    return handleError(error);
  }
}
