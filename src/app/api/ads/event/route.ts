import { NextRequest } from 'next/server';
import { clientIp, detectDevice, handleError, ok } from '@/lib/api';
import { getAuth } from '@/lib/auth';
import { enforce, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { adEventSchema } from '@/lib/validation';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';

/**
 * Registro de impresiones y clics.
 *
 * El consumo de presupuesto se calcula aquí, no en el cliente: una impresión
 * CPM descuenta la milésima parte del CPM, y un clic CPC descuenta el CPC.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth();
    await enforce(`adevent:${auth?.user.id ?? clientIp(req) ?? 'anon'}`, RATE_LIMITS.adEvent);

    const input = adEventSchema.parse(await req.json());
    const day = new Date().toISOString().slice(0, 10);
    const device = detectDevice(req.headers.get('user-agent'));

    const campaign = await db.adCampaign.findUnique({
      where: { id: input.campaignId },
      select: { id: true, pricingModel: true, unitPriceCents: true },
    });
    if (!campaign) return ok({ recorded: false });

    if (input.type === 'IMPRESSION') {
      await db.adImpression.create({
        data: {
          creativeId: input.creativeId,
          campaignId: input.campaignId,
          userId: auth?.user.id ?? null,
          slotCode: input.slotCode,
          page: input.page,
          device,
          day,
        },
      });
      if (campaign.pricingModel === 'CPM') {
        await db.adCampaign.update({
          where: { id: campaign.id },
          data: { spentCents: { increment: Math.round(campaign.unitPriceCents / 1000) } },
        });
      }
      await track(ANALYTICS_EVENTS.AD_IMPRESSION, { slot: input.slotCode, page: input.page }, { userId: auth?.user.id });
    } else if (input.type === 'VIEWABLE') {
      // Marca como visible la última impresión registrada de esa creatividad.
      const last = await db.adImpression.findFirst({
        where: { creativeId: input.creativeId, userId: auth?.user.id ?? null, day },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (last) await db.adImpression.update({ where: { id: last.id }, data: { viewable: true } });
    } else {
      await db.adClick.create({
        data: {
          creativeId: input.creativeId,
          campaignId: input.campaignId,
          userId: auth?.user.id ?? null,
          slotCode: input.slotCode,
        },
      });
      if (campaign.pricingModel === 'CPC') {
        await db.adCampaign.update({
          where: { id: campaign.id },
          data: { spentCents: { increment: campaign.unitPriceCents } },
        });
      }
      await track(ANALYTICS_EVENTS.AD_CLICK, { slot: input.slotCode }, { userId: auth?.user.id });
    }

    return ok({ recorded: true });
  } catch (error) {
    return handleError(error);
  }
}
