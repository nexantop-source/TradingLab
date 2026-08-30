import { NextRequest } from 'next/server';
import { z } from 'zod';
import { clientIp, detectDevice, handleError, ok } from '@/lib/api';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import {
  AD_SLOT_BY_CODE,
  isForbiddenSurface,
  selectAd,
  stableAdSeed,
  type CandidateCreative,
} from '@tl/ads';
import {
  adEventSecretConfigured,
  adViewerBinding,
  issueAdEventToken,
} from '@/components/ads/ad-event-security';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';

const querySchema = z.object({
  slot: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/),
  page: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9/_-]+$/).default('/'),
  topic: z.string().trim().max(60).regex(/^[^\u0000-\u001F\u007F]*$/).optional(),
});

/**
 * Selección de anuncio.
 *
 * La decisión se toma íntegramente en el servidor: el navegador no recibe el
 * inventario, solo la creatividad elegida. Así las reglas de exclusión (plan
 * Premium, superficies prohibidas, frequency capping) no dependen del cliente.
 */
export async function GET(req: NextRequest) {
  try {
    const provider = (
      process.env.ADS_PROVIDER ?? (process.env.NODE_ENV === 'production' ? 'off' : 'internal')
    )
      .trim()
      .toLowerCase();
    if (provider !== 'internal') {
      return ok({ ad: null, reason: 'INTERNAL_PROVIDER_DISABLED' });
    }
    const params = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const auth = await getAuth();
    const plan = auth?.user.plan ?? 'FREE';

    // Atajo: los usuarios Premium no generan ni siquiera una consulta al
    // inventario. Criterio de aceptación #12.
    if (plan === 'PREMIUM') {
      return ok({ ad: null, reason: 'PLAN_PREMIUM_NO_ADS' });
    }

    const descriptor = AD_SLOT_BY_CODE.get(params.slot);
    if (!descriptor) return ok({ ad: null, reason: 'UNKNOWN_SLOT' });
    if (isForbiddenSurface(descriptor.surface) || isForbiddenSurface(params.page)) {
      return ok({ ad: null, reason: 'FORBIDDEN_SURFACE' });
    }

    // Sin secreto no se entrega una creatividad cuyos eventos no puedan
    // autenticarse. El motor queda desactivado de forma segura.
    if (!adEventSecretConfigured()) {
      return ok({ ad: null, reason: 'ADS_SIGNING_NOT_CONFIGURED' });
    }

    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);

    const [creatives, impressionsToday, profile] = await Promise.all([
      db.creative.findMany({
        where: {
          reviewStatus: 'APPROVED',
          placement: { adUnitId: params.slot, page: params.page, active: true, adUnit: { active: true } },
          campaign: { status: 'ACTIVE', advertiser: { status: 'APPROVED' } },
        },
        include: { campaign: { include: { advertiser: true } } },
      }),
      auth
        ? db.adImpression.groupBy({
            by: ['creativeId'],
            where: { userId: auth.user.id, day },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      auth
        ? db.profile.findUnique({ where: { userId: auth.user.id }, select: { marketInterests: true } })
        : Promise.resolve(null),
    ]);

    const impressionMap: Record<string, number> = {};
    for (const row of impressionsToday) impressionMap[row.creativeId] = row._count._all;

    const candidates: CandidateCreative[] = creatives.map((c) => {
      const targeting = fromJson<{
        countries?: string[] | null;
        locales?: string[] | null;
        devices?: string[] | null;
        topics?: string[] | null;
        marketInterests?: string[] | null;
        hourRange?: [number, number] | null;
      }>(c.campaign.targeting, {});

      return {
        id: c.id,
        campaignId: c.campaignId,
        advertiserName: c.campaign.advertiser.name,
        headline: c.headline,
        body: c.body,
        ctaLabel: c.ctaLabel,
        destinationUrl: c.destinationUrl,
        imageUrl: c.imageUrl,
        slotCode: params.slot,
        priority: c.campaign.priority,
        pricingModel: c.campaign.pricingModel,
        countries: targeting.countries ?? null,
        locales: targeting.locales ?? null,
        devices: targeting.devices ?? null,
        topics: targeting.topics ?? null,
        marketInterests: targeting.marketInterests ?? null,
        hourRange: targeting.hourRange ?? null,
        frequencyCapPerDay: c.campaign.frequencyCapPerDay,
        startsAt: c.campaign.startsAt,
        endsAt: c.campaign.endsAt,
        status: c.campaign.status,
        remainingBudgetCents: c.campaign.budgetCents - c.campaign.spentCents,
      };
    });

    // Bucket de diez minutos: Standard rota de forma determinística a lo largo
    // del día en vez de quedar bloqueado con el mismo resultado durante 24 h.
    const opportunityBucket = Math.floor(now / (10 * 60 * 1000));
    const viewerSource = auth
      ? `user:${auth.user.id}:session:${auth.sessionId}`
      : `anon:${clientIp(req) ?? 'unknown'}:ua:${req.headers.get('user-agent') ?? 'unknown'}`;
    const rotationSeed = stableAdSeed(`${viewerSource}:${day}:${params.slot}:${opportunityBucket}`);

    const result = selectAd({
      slotCode: params.slot,
      targeting: {
        countryCode: null,
        locale: auth?.user.locale ?? 'es',
        device: detectDevice(req.headers.get('user-agent')),
        page: params.page,
        educationalTopic: params.topic ?? null,
        plan,
        marketInterest: profile ? fromJson<string[]>(profile.marketInterests, []) : [],
        hourLocal: new Date().getUTCHours(),
      },
      candidates,
      impressionsToday: impressionMap,
      now,
      rotationSeed,
    });

    if (!result.ad) {
      await track(ANALYTICS_EVENTS.AD_NO_FILL, { slot: params.slot, reason: result.reason }, { userId: auth?.user.id });
    }

    if (!result.ad) return ok({ ad: null, reason: result.reason });

    const secret = process.env.ADS_EVENT_TOKEN_SECRET as string;
    const viewer = await adViewerBinding(secret, viewerSource);
    const eventToken = await issueAdEventToken(
      secret,
      {
        creativeId: result.ad.creativeId,
        campaignId: result.ad.campaignId,
        slotCode: params.slot,
        page: params.page,
        viewer,
      },
      now,
    );

    return ok({ ad: { ...result.ad, eventToken }, reason: result.reason });
  } catch (error) {
    return handleError(error);
  }
}
