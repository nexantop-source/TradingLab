import type { Metadata } from 'next';
import Link from 'next/link';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { subscriptionMetrics } from '@/lib/billing';
import { monthlyCostUsd, monthlyCap } from '@/lib/ai-budget';
import { marketData } from '@tl/market-data';
import { can } from '@/lib/rbac';
import { Badge, Card } from '@tl/ui';
import { formatUsd, formatVirtualUsd } from '@/lib/format';
import { NORTH_STAR } from '@tl/analytics';

export const metadata: Metadata = { title: 'Panel administrativo' };
export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const auth = await getAuth();
  const role = auth!.user.role;

  const now = Date.now();
  const day = new Date(now - 86400000);
  const week = new Date(now - 7 * 86400000);
  const month = new Date(now - 30 * 86400000);

  const [
    totalUsers,
    newUsers7d,
    activeUsers1d,
    activeUsers30d,
    simulations7d,
    openSimulations,
    aiCalls30d,
    flaggedAnalyses,
    lessonsCompleted7d,
    openTickets,
    adImpressions7d,
    adClicks7d,
    metrics,
    aiCost,
    activatedUsers,
  ] = await Promise.all([
    db.user.count({ where: { status: 'ACTIVE' } }),
    db.user.count({ where: { createdAt: { gte: week } } }),
    db.user.count({ where: { lastSeenAt: { gte: day } } }),
    db.user.count({ where: { lastSeenAt: { gte: month } } }),
    db.simulation.count({ where: { openedAt: { gte: week } } }),
    db.simulation.count({ where: { status: 'OPEN' } }),
    db.aIAnalysis.count({ where: { createdAt: { gte: month } } }),
    db.aIAnalysis.count({ where: { flagged: true, createdAt: { gte: month } } }),
    db.userProgress.count({ where: { status: 'COMPLETED', updatedAt: { gte: week } } }),
    db.supportTicket.count({ where: { status: 'OPEN' } }),
    db.adImpression.count({ where: { createdAt: { gte: week } } }),
    db.adClick.count({ where: { createdAt: { gte: week } } }),
    subscriptionMetrics(),
    monthlyCostUsd(true),
    // Activación: usuarios con al menos una lección completada y una simulación.
    db.user.count({
      where: {
        onboardingCompleted: true,
        progress: { some: { status: 'COMPLETED' } },
        simulations: { some: {} },
      },
    }),
  ]);

  const provider = marketData();
  const health = await provider.healthCheck().catch(() => ({ ok: false, latencyMs: 0, message: 'sin respuesta' }));
  const cap = monthlyCap();
  const activationRate = totalUsers > 0 ? (activatedUsers / totalUsers) * 100 : 0;
  const ctr = adImpressions7d > 0 ? (adClicks7d / adImpressions7d) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Resumen</h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
          Métrica principal del producto: <span className="font-medium">{NORTH_STAR.label}</span>.{' '}
          {NORTH_STAR.description}
        </p>
      </header>

      {/* North star */}
      <Card className="p-5">
        <p className="text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">{NORTH_STAR.label}</p>
        <p className="num mt-1 text-4xl font-semibold tracking-tight">{activationRate.toFixed(1)} %</p>
        <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
          {activatedUsers} de {totalUsers} usuarios han completado el onboarding, al menos una lección y al menos
          una simulación.
        </p>
      </Card>

      {/* Métricas */}
      <section>
        <h2 className="text-[15px] font-semibold">Producto</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Usuarios activos" value={String(totalUsers)} hint={`+${newUsers7d} en 7 días`} />
          <Stat label="Activos hoy" value={String(activeUsers1d)} hint={`${activeUsers30d} en 30 días`} />
          <Stat label="Simulaciones (7 d)" value={String(simulations7d)} hint={`${openSimulations} abiertas ahora`} />
          <Stat label="Lecciones completadas (7 d)" value={String(lessonsCompleted7d)} hint="Progreso educativo" />
        </div>
      </section>

      {can(role, 'subscriptions:read') && (
        <section>
          <h2 className="text-[15px] font-semibold">Ingresos por suscripción</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="MRR" value={formatUsd(metrics.mrrUsd)} hint={`ARR ${formatUsd(metrics.arrUsd)}`} />
            <Stat
              label="Suscriptores activos"
              value={String(metrics.activePaying)}
              hint={`${metrics.trialing} en periodo de prueba`}
            />
            <Stat label="Conversión a plan de pago" value={`${metrics.conversionPercent} %`} hint="Sobre usuarios activos" />
            <Stat label="Churn 30 días" value={`${metrics.churnPercent} %`} hint={`ARPU ${formatUsd(metrics.arpuUsd)}`} />
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {can(role, 'ai:read') && (
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold">Inteligencia artificial</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              <Row label="Análisis generados (30 d)" value={String(aiCalls30d)} />
              <Row label="Respuestas marcadas por guardarraíles" value={String(flaggedAnalyses)} />
              <Row label="Coste estimado del mes" value={formatUsd(aiCost)} />
              <Row label="Tope mensual configurado" value={cap ? formatUsd(cap) : 'sin tope'} />
            </dl>
            {cap > 0 && aiCost >= cap * 0.8 && (
              <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-gold)]">
                Se ha superado el 80 % del tope de coste. Al alcanzarlo, los análisis pasan al motor determinístico
                local, indicándolo al usuario.
              </p>
            )}
            <Link href="/admin/ia" className="mt-3 block text-[12px] text-[var(--color-blue)] hover:underline">
              Ver el detalle →
            </Link>
          </Card>
        )}

        {can(role, 'data:read') && (
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold">Datos de mercado</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              <Row label="Proveedor activo" value={provider.label} />
              <Row label="Tipo de serie" value={provider.synthetic ? 'Educativa determinística' : 'Mercado real'} />
              <Row label="Latencia declarada" value={`${provider.declaredDelaySeconds} s`} />
              <Row label="Estado" value={health.ok ? 'Operativo' : 'Degradado'} />
            </dl>
            <Link href="/admin/datos" className="mt-3 block text-[12px] text-[var(--color-blue)] hover:underline">
              Gestionar proveedores →
            </Link>
          </Card>
        )}

        {can(role, 'ads:read') && (
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold">Publicidad (7 días)</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              <Row label="Impresiones" value={adImpressions7d.toLocaleString('es-ES')} />
              <Row label="Clics" value={adClicks7d.toLocaleString('es-ES')} />
              <Row label="CTR" value={`${ctr.toFixed(2)} %`} />
            </dl>
            <Link href="/admin/publicidad" className="mt-3 block text-[12px] text-[var(--color-blue)] hover:underline">
              Ver campañas →
            </Link>
          </Card>
        )}

        {can(role, 'support:read') && (
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold">Soporte</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              <Row label="Tickets abiertos" value={String(openTickets)} />
            </dl>
            <Link href="/admin/soporte" className="mt-3 block text-[12px] text-[var(--color-blue)] hover:underline">
              Abrir la bandeja →
            </Link>
          </Card>
        )}
      </div>

      <Card className="border-[color-mix(in_srgb,var(--color-blue)_22%,transparent)] bg-[var(--color-blue-soft)] p-5">
        <h2 className="text-[13px] font-semibold text-[var(--color-blue)]">Criterio de producto</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
          La rentabilidad virtual de los estudiantes no es un indicador de éxito y no aparece en este panel de
          forma agregada. Lo que medimos es activación, retención, finalización de cursos, mejora en las
          evaluaciones y calidad del proceso de decisión.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">{label}</p>
      <p className="num mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--color-subtle)]">{hint}</p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="num text-right text-[var(--color-text)]">{value}</dd>
    </div>
  );
}
