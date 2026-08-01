import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { subscriptionMetrics } from '@/lib/billing';
import { monthlyCostUsd } from '@/lib/ai-budget';
import { METRICS, NORTH_STAR } from '@tl/analytics';
import { computeStats, type SimulationSample } from '@tl/simulation-engine';
import { INITIAL_DEMO_BALANCE_CENTS } from '@tl/types';
import { Badge, Card, Callout } from '@tl/ui';
import { formatUsd } from '@/lib/format';

export const metadata: Metadata = { title: 'Analítica del negocio' };
export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
  adquisicion: 'Adquisición',
  activacion: 'Activación',
  retencion: 'Retención',
  ingresos: 'Ingresos',
  costes: 'Costes',
  educacion: 'Educación',
  publicidad: 'Publicidad',
  calidad: 'Calidad',
};

export default async function AdminAnalyticsPage() {
  const auth = await getAuth();
  if (!auth || !can(auth.user.role, 'analytics:read')) redirect('/panel');

  const now = Date.now();
  const day = new Date(now - 86400000);
  const week = new Date(now - 7 * 86400000);
  const month = new Date(now - 30 * 86400000);

  const [
    totalUsers,
    signups30d,
    dau,
    mau,
    withLesson,
    withSimulation,
    activated,
    metrics,
    aiCost,
    aiUsers,
    coursesStarted,
    coursesCompleted,
    journalEntries,
    simulationCount,
    impressions30d,
    clicks30d,
    viewable30d,
    tickets30d,
    events,
    allSims,
    retention,
  ] = await Promise.all([
    db.user.count({ where: { status: 'ACTIVE' } }),
    db.user.count({ where: { createdAt: { gte: month } } }),
    db.user.count({ where: { lastSeenAt: { gte: day } } }),
    db.user.count({ where: { lastSeenAt: { gte: month } } }),
    db.user.count({ where: { progress: { some: { status: 'COMPLETED' } } } }),
    db.user.count({ where: { simulations: { some: {} } } }),
    db.user.count({
      where: {
        onboardingCompleted: true,
        progress: { some: { status: 'COMPLETED' } },
        simulations: { some: {} },
      },
    }),
    subscriptionMetrics(),
    monthlyCostUsd(true),
    db.aIUsage.groupBy({ by: ['userId'], where: { month: new Date().toISOString().slice(0, 7) } }),
    db.userProgress.groupBy({ by: ['userId'] }),
    db.userProgress.groupBy({ by: ['userId'], where: { status: 'COMPLETED' } }),
    db.journalEntry.count(),
    db.simulation.count(),
    db.adImpression.count({ where: { createdAt: { gte: month } } }),
    db.adClick.count({ where: { createdAt: { gte: month } } }),
    db.adImpression.count({ where: { viewable: true, createdAt: { gte: month } } }),
    db.supportTicket.count({ where: { createdAt: { gte: month } } }),
    db.analyticsEvent.groupBy({ by: ['name'], where: { createdAt: { gte: week } }, _count: { _all: true } }),
    db.simulation.findMany({
      take: 1000,
      orderBy: { openedAt: 'desc' },
      include: { journalEntry: { select: { id: true } } },
    }),
    computeRetention(),
  ]);

  const samples: SimulationSample[] = allSims.map((s, i) => ({
    id: s.id,
    symbol: s.symbol,
    assetClass: s.assetClass,
    mode: s.mode,
    direction: s.direction,
    outcome: s.outcome as SimulationSample['outcome'],
    pnlCents: s.pnlCents,
    stakeCents: s.stakeCents,
    leverage: s.leverage,
    hasStopLoss: s.stopLoss != null,
    hasTakeProfit: s.takeProfit != null,
    riskReward: null,
    rationaleLength: s.rationale.length,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
    hasJournalEntry: Boolean(s.journalEntry),
    minutesSincePrevious: null,
    strategyTag: s.strategyTag,
  }));
  const globalStats = computeStats(samples, INITIAL_DEMO_BALANCE_CENTS);

  const pct = (n: number, d: number) => (d > 0 ? Number(((n / d) * 100).toFixed(1)) : 0);

  const values: Record<string, string> = {
    signups: String(signups30d),
    activation_rate: `${pct(activated, totalUsers)} %`,
    first_lesson_rate: `${pct(withLesson, totalUsers)} %`,
    first_simulation_rate: `${pct(withSimulation, totalUsers)} %`,
    dau: String(dau),
    mau: String(mau),
    retention_d1: `${retention.d1} %`,
    retention_d7: `${retention.d7} %`,
    retention_d30: `${retention.d30} %`,
    conversion_free_standard: `${pct(metrics.byPlan.STANDARD ?? 0, totalUsers)} %`,
    conversion_free_premium: `${pct(metrics.byPlan.PREMIUM ?? 0, totalUsers)} %`,
    mrr: formatUsd(metrics.mrrUsd),
    arr: formatUsd(metrics.arrUsd),
    churn: `${metrics.churnPercent} %`,
    arpu: formatUsd(metrics.arpuUsd),
    ltv: metrics.churnPercent > 0 ? formatUsd((metrics.arpuUsd * 100) / metrics.churnPercent) : 'sin datos',
    cac: 'pendiente de conectar la inversión en adquisición',
    ai_calls: String(events.find((e) => e.name === 'ai_analysis_requested')?._count._all ?? 0),
    ai_cost_per_user: mau > 0 ? formatUsd(aiCost / mau) : formatUsd(0),
    data_cost_per_user: formatUsd(0),
    course_completion: `${pct(coursesCompleted.length, Math.max(coursesStarted.length, 1))} %`,
    quiz_improvement: 'ver detalle por estudiante',
    journal_coverage: `${pct(journalEntries, Math.max(simulationCount, 1))} %`,
    discipline_score_avg: String(globalStats.disciplineScore),
    ad_revenue: 'según campañas activas',
    ecpm: impressions30d > 0 ? formatUsd((clicks30d * 0.6 * 1000) / impressions30d) : formatUsd(0),
    fill_rate: 'ver panel de publicidad',
    viewability: `${pct(viewable30d, Math.max(impressions30d, 1))} %`,
    arpu_free: formatUsd(0),
    support_tickets: String(tickets30d),
    error_rate: 'ver observabilidad',
    p95_latency: 'ver observabilidad',
  };

  const byCategory = new Map<string, typeof METRICS>();
  for (const m of METRICS) {
    const list = byCategory.get(m.category);
    if (list) list.push(m);
    else byCategory.set(m.category, [m]);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Analítica del negocio</h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
          Ventana de 30 días salvo indicación contraria. Los eventos se registran en la tabla{' '}
          <span className="num">AnalyticsEvent</span>.
        </p>
      </header>

      <Callout tone="info" title={`Métrica principal: ${NORTH_STAR.label}`}>
        {NORTH_STAR.description} Deliberadamente, la rentabilidad virtual de los estudiantes no forma parte de
        ningún indicador de éxito del producto.
      </Callout>

      {Array.from(byCategory.entries()).map(([category, list]) => (
        <section key={category}>
          <h2 className="text-[15px] font-semibold">{CATEGORY_LABEL[category] ?? category}</h2>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((m) => (
              <Card key={m.key} className={`p-4 ${m.northStar ? 'border-[var(--color-blue)]' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">{m.label}</p>
                  {m.northStar && <Badge tone="blue">Principal</Badge>}
                </div>
                <p className="num mt-1.5 text-lg font-semibold tracking-tight">{values[m.key] ?? '—'}</p>
                <p className="mt-1 text-[11px] leading-snug text-[var(--color-subtle)]">{m.description}</p>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Eventos registrados (7 días)</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-[12px] text-[var(--color-muted)]">Sin eventos en el periodo.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {events
              .sort((a, b) => b._count._all - a._count._all)
              .slice(0, 20)
              .map((e) => (
                <li key={e.name} className="flex justify-between text-[12px]">
                  <span className="num text-[var(--color-muted)]">{e.name}</span>
                  <span className="num">{e._count._all}</span>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/**
 * Retención por cohorte simple: de los usuarios registrados hace N días,
 * cuántos han tenido actividad en los últimos N días.
 */
async function computeRetention(): Promise<{ d1: number; d7: number; d30: number }> {
  const now = Date.now();

  async function forWindow(days: number): Promise<number> {
    const cohortStart = new Date(now - (days + 1) * 86400000);
    const cohortEnd = new Date(now - days * 86400000);
    const cohort = await db.user.count({ where: { createdAt: { gte: cohortStart, lt: cohortEnd } } });
    if (cohort === 0) return 0;
    const returned = await db.user.count({
      where: {
        createdAt: { gte: cohortStart, lt: cohortEnd },
        lastSeenAt: { gte: cohortEnd },
      },
    });
    return Number(((returned / cohort) * 100).toFixed(1));
  }

  const [d1, d7, d30] = await Promise.all([forWindow(1), forWindow(7), forWindow(30)]);
  return { d1, d7, d30 };
}
