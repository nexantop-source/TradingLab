import { NextRequest } from 'next/server';
import { z } from 'zod';
import { clientIp, detectDevice, handleError, ok } from '@/lib/api';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import { selectAd, type CandidateCreative } from '@tl/ads';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';

const querySchema = z.object({
  slot: z.string().min(1).max(60),
  page: z.string().max(120).default('/'),
  topic: z.string().max(60).optional(),
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
    const params = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const auth = await getAuth();
    const plan = auth?.user.plan ?? 'FREE';

    // Atajo: los usuarios Premium no generan ni siquiera una consulta al
    // inventario. Criterio de aceptación #12.
    if (plan === 'PREMIUM') {
      return ok({ ad: null, reason: 'PLAN_PREMIUM_NO_ADS' });
    }

    const day = new Date().toISOString().slice(0, 10);

    const [creatives, impressionsToday, profile] = await Promise.all([
      db.creative.findMany({
        where: {
          reviewStatus: 'APPROVED',
          placement: { adUnitId: params.slot, active: true },
          campaign: { status: 'ACTIVE' },
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

    // Semilla de rotación estable por usuario y día: reparte el inventario sin
    // recurrir a aleatoriedad, de modo que la elección sea reproducible.
    const seedSource = `${auth?.user.id ?? clientIp(req) ?? 'anon'}:${day}:${params.slot}`;
    let rotationSeed = 0;
    for (let i = 0; i < seedSource.length; i++) {
      rotationSeed = (rotationSeed * 31 + seedSource.charCodeAt(i)) >>> 0;
    }

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
      now: Date.now(),
      rotationSeed,
    });

    if (!result.ad) {
      await track(ANALYTICS_EVENTS.AD_NO_FILL, { slot: params.slot, reason: result.reason }, { userId: auth?.user.id });
    }

    return ok({
      ad: result.ad,
      reason: result.reason,
      /** Alto reservado: el cliente lo aplica siempre, haya anuncio o no. */
      reservedHeight: creatives[0] ? undefined : undefined,
    });
  } catch (error) {
    return handleError(error);
  }
}
