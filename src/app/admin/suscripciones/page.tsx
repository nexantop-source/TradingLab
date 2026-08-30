import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { subscriptionMetrics } from '@/lib/billing';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
import { PLANS } from '@tl/types';
import { Badge, Card } from '@tl/ui';
import { formatCurrency, formatDateTime, formatUsd } from '@/lib/format';

export const metadata: Metadata = { title: 'Suscripciones' };
export const dynamic = 'force-dynamic';

export default async function AdminSubscriptionsPage() {
  const auth = await getAuth();
  if (!auth || !can(auth.user.role, 'subscriptions:read')) redirect('/panel');

  const [metrics, subscriptions, payments, coupons, webhookErrors] = await Promise.all([
    subscriptionMetrics(),
    db.subscription.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { user: { select: { email: true, name: true } } },
    }),
    db.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 25, include: { user: { select: { email: true } } } }),
    db.coupon.findMany({ orderBy: { createdAt: 'desc' } }),
    db.webhookEvent.findMany({ where: { error: { not: null } }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Suscripciones</h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
          Planes, valor mensualizado, pagos y cupones. Los pagos son idempotentes por clave y los webhooks no se
          procesan dos veces. Wompi cobra un periodo por compra; no hay débito automático futuro.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Valor mensualizado" value={formatUsd(metrics.mrrUsd)} />
        <Stat label="Valor anualizado" value={formatUsd(metrics.arrUsd)} />
        <Stat label="Suscriptores" value={String(metrics.activePaying)} hint={`${metrics.trialing} en prueba`} />
        <Stat label="Churn 30 d" value={`${metrics.churnPercent} %`} hint={`ARPU ${formatUsd(metrics.arpuUsd)}`} />
      </div>

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Planes configurados</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-[12px]">
            <caption className="sr-only">Configuración de planes</caption>
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
                <th scope="col" className="px-3 py-2 text-left font-medium">Plan</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Mensual</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Anual</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Simulaciones/día</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Análisis IA</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Publicidad</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Suscriptores</th>
              </tr>
            </thead>
            <tbody>
              {PLANS.map((id) => {
                const p = PLAN_ENTITLEMENTS[id];
                return (
                  <tr key={id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="num px-3 py-2 text-right">{formatUsd(p.priceMonthlyUsd)}</td>
                    <td className="num px-3 py-2 text-right">{formatUsd(p.priceYearlyUsd)}</td>
                    <td className="num px-3 py-2 text-right">{p.simulationsPerDay ?? 'sin límite'}</td>
                    <td className="num px-3 py-2 text-right">
                      {p.aiAnalysesPerDay != null ? `${p.aiAnalysesPerDay}/día` : `${p.aiAnalysesPerMonth}/mes`}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={p.adDensity === 'none' ? 'positive' : p.adDensity === 'reduced' ? 'blue' : 'neutral'}>
                        {p.adDensity === 'none' ? 'sin publicidad' : p.adDensity === 'reduced' ? 'reducida' : 'prioritaria'}
                      </Badge>
                    </td>
                    <td className="num px-3 py-2 text-right">{metrics.byPlan[id] ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <div className="border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">Suscripciones recientes</h2>
        </div>
        <table className="w-full min-w-[44rem] text-[12px]">
          <caption className="sr-only">Suscripciones recientes</caption>
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Usuario</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Plan</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Periodicidad</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Estado</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Acceso hasta</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Cupón</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((s) => (
              <tr key={s.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-4 py-2.5 text-[var(--color-muted)]">{s.user.email}</td>
                <td className="px-4 py-2.5 font-medium">{s.planId}</td>
                <td className="px-4 py-2.5 text-[var(--color-muted)]">
                  {s.interval === 'YEARLY' ? 'Anual' : 'Mensual'}
                </td>
                <td className="px-4 py-2.5">
                  <Badge
                    tone={
                      s.status === 'ACTIVE'
                        ? 'positive'
                        : s.status === 'TRIALING'
                          ? 'blue'
                          : s.status === 'PAST_DUE'
                            ? 'gold'
                            : 'neutral'
                    }
                  >
                    {s.status}
                  </Badge>
                  {s.cancelAtPeriodEnd && <span className="ml-1.5 text-[10px] text-[var(--color-gold)]">cancelada</span>}
                </td>
                <td className="px-4 py-2.5 text-[11px] text-[var(--color-muted)]">
                  {formatDateTime(s.currentPeriodEnd, auth.user.timezone)}
                </td>
                <td className="num px-4 py-2.5 text-[var(--color-muted)]">{s.couponCode ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Pagos recientes</h2>
          <ul className="mt-3 space-y-1.5">
            {payments.length === 0 && (
              <li className="text-[12px] text-[var(--color-muted)]">Todavía no hay pagos registrados.</li>
            )}
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">{p.user.email}</span>
                <span className="num">{formatCurrency(p.amountCents / 100, p.currency)}</span>
                <Badge tone={p.status === 'SUCCEEDED' ? 'positive' : ['REFUNDED', 'REVIEW_REQUIRED'].includes(p.status) ? 'gold' : 'negative'}>
                  {p.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Cupones</h2>
          {coupons.length === 0 ? (
            <p className="mt-3 text-[12px] text-[var(--color-muted)]">
              No hay cupones creados. Se gestionan desde la tabla <span className="num">Coupon</span>.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {coupons.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="num font-medium">{c.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">{c.description}</span>
                  <span className="num text-[var(--color-subtle)]">
                    {c.percentOff ? `${c.percentOff} %` : formatUsd((c.amountOffCents ?? 0) / 100)}
                  </span>
                  <span className="num text-[10px] text-[var(--color-subtle)]">{c.timesRedeemed} usos</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {webhookErrors.length > 0 && (
        <Card className="border-[color-mix(in_srgb,var(--color-negative)_22%,transparent)] bg-[var(--color-negative-soft)] p-5">
          <h2 className="text-[13px] font-semibold text-[var(--color-negative)]">Webhooks con error</h2>
          <ul className="mt-3 space-y-1.5">
            {webhookErrors.map((w) => (
              <li key={w.id} className="text-[12px] text-[var(--color-muted)]">
                · <span className="num">{w.type}</span> ({w.externalId}): {w.error}
              </li>
            ))}
          </ul>
        </Card>
      )}
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
