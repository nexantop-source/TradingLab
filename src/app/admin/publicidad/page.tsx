import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import { AD_SLOTS, SPONSOR_PACKAGES, PRICING_MODEL_LABEL, FORBIDDEN_SURFACES } from '@tl/ads';
import { Badge, Card, Callout, Progress } from '@tl/ui';
import { formatUsd } from '@/lib/format';

export const metadata: Metadata = { title: 'Publicidad' };
export const dynamic = 'force-dynamic';

export default async function AdminAdsPage() {
  const auth = await getAuth();
  if (!auth || !can(auth.user.role, 'ads:read')) redirect('/panel');

  const week = new Date(Date.now() - 7 * 86400000);

  const [campaigns, advertisers, impressionsBySlot, clicksByCampaign, viewable, totalImpressions, pendingCreatives] =
    await Promise.all([
      db.adCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          advertiser: true,
          creatives: { select: { id: true, reviewStatus: true } },
          _count: { select: { impressions: true, clicks: true } },
        },
      }),
      db.advertiser.findMany({ orderBy: { createdAt: 'desc' } }),
      db.adImpression.groupBy({ by: ['slotCode'], where: { createdAt: { gte: week } }, _count: { _all: true } }),
      db.adClick.groupBy({ by: ['campaignId'], where: { createdAt: { gte: week } }, _count: { _all: true } }),
      db.adImpression.count({ where: { viewable: true, createdAt: { gte: week } } }),
      db.adImpression.count({ where: { createdAt: { gte: week } } }),
      db.creative.findMany({
        where: { reviewStatus: 'PENDING' },
        include: { campaign: { include: { advertiser: true } } },
      }),
    ]);

  const clicksByCampaignMap = new Map(clicksByCampaign.map((c) => [c.campaignId, c._count._all]));
  const viewabilityPercent = totalImpressions > 0 ? (viewable / totalImpressions) * 100 : 0;
  const totalRevenueCents = campaigns.reduce((a, c) => a + c.spentCents, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Publicidad</h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[var(--color-muted)]">
          Inventario, campañas, anunciantes y métricas. Las ubicaciones prohibidas están aplicadas en el servidor
          y en el componente de renderizado: no dependen de la configuración de cada campaña.
        </p>
      </header>

      {pendingCreatives.length > 0 && (
        <Callout tone="warning" title={`${pendingCreatives.length} creatividad(es) pendientes de revisión`}>
          {pendingCreatives.map((c) => (
            <span key={c.id} className="block">
              · {c.campaign.advertiser.name} — «{c.headline}»
            </span>
          ))}
        </Callout>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Ingresos reconocidos" value={formatUsd(totalRevenueCents / 100)} hint="Acumulado de campañas" />
        <Stat label="Impresiones (7 d)" value={totalImpressions.toLocaleString('es-ES')} />
        <Stat label="Viewability" value={`${viewabilityPercent.toFixed(1)} %`} hint="Visible ≥ 1 s" />
        <Stat label="Campañas activas" value={String(campaigns.filter((c) => c.status === 'ACTIVE').length)} />
      </div>

      <Card className="overflow-x-auto">
        <div className="border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">Campañas</h2>
        </div>
        <table className="w-full min-w-[52rem] text-[12px]">
          <caption className="sr-only">Campañas publicitarias</caption>
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Campaña</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Anunciante</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Modelo</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Presupuesto</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Impresiones</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Clics</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">CTR</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const clicks = clicksByCampaignMap.get(c.id) ?? c._count.clicks;
              const ctr = c._count.impressions > 0 ? (c._count.clicks / c._count.impressions) * 100 : 0;
              return (
                <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="block font-medium">{c.name}</span>
                    {c.packageCode && (
                      <span className="num block text-[10px] text-[var(--color-subtle)]">{c.packageCode}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-muted)]">{c.advertiser.name}</td>
                  <td className="px-4 py-2.5 text-[var(--color-muted)]">
                    {PRICING_MODEL_LABEL[c.pricingModel] ?? c.pricingModel}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="num block">{formatUsd(c.spentCents / 100)}</span>
                    <span className="num block text-[10px] text-[var(--color-subtle)]">
                      de {formatUsd(c.budgetCents / 100)}
                    </span>
                    <Progress className="mt-1" value={c.spentCents} max={Math.max(c.budgetCents, 1)} label={c.name} />
                  </td>
                  <td className="num px-4 py-2.5 text-right">{c._count.impressions}</td>
                  <td className="num px-4 py-2.5 text-right">{clicks}</td>
                  <td className="num px-4 py-2.5 text-right">{ctr.toFixed(2)} %</td>
                  <td className="px-4 py-2.5">
                    <Badge
                      tone={
                        c.status === 'ACTIVE'
                          ? 'positive'
                          : c.status === 'PENDING_REVIEW'
                            ? 'gold'
                            : c.status === 'REJECTED'
                              ? 'negative'
                              : 'neutral'
                      }
                    >
                      {c.status}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Impresiones por espacio (7 días)</h2>
          <ul className="mt-3 space-y-1.5">
            {AD_SLOTS.map((s) => {
              const count = impressionsBySlot.find((i) => i.slotCode === s.code)?._count._all ?? 0;
              return (
                <li key={s.code} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">{s.label}</span>
                  <span className="num">{count}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Anunciantes</h2>
          <ul className="mt-3 space-y-2">
            {advertisers.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                <span className="num text-[10px] text-[var(--color-subtle)]">{a.category}</span>
                <Badge tone={a.status === 'APPROVED' ? 'positive' : a.status === 'BLOCKED' ? 'negative' : 'gold'}>
                  {a.status}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-subtle)]">
            Los anunciantes de categoría financiera requieren revisión manual de cumplimiento antes de poder
            activar campañas.
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Paquetes comerciales configurables</h2>
        <ul className="mt-3 space-y-2">
          {SPONSOR_PACKAGES.map((p) => (
            <li key={p.code} className="flex flex-wrap items-center gap-3 text-[12px]">
              <span className="min-w-0 flex-1 font-medium">{p.name}</span>
              <span className="num text-[var(--color-muted)]">desde {formatUsd(p.monthlyPriceUsdFrom)}/mes</span>
              <span className="num text-[10px] text-[var(--color-subtle)]">{p.slots.join(', ')}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-[color-mix(in_srgb,var(--color-negative)_22%,transparent)] bg-[var(--color-negative-soft)] p-5">
        <h2 className="text-[13px] font-semibold text-[var(--color-negative)]">Superficies bloqueadas</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-muted)]">
          No es posible servir publicidad en estas superficies, aunque se cree un emplazamiento por error:{' '}
          <span className="num">{FORBIDDEN_SURFACES.join(', ')}</span>. Además, los usuarios del plan Premium no
          generan ninguna solicitud de anuncio.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">{label}</p>
      <p className="num mt-1.5 text-xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-[var(--color-subtle)]">{hint}</p>}
    </Card>
  );
}
