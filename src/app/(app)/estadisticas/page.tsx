import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { historyCutoff } from '@/lib/entitlements';
import { computeStats, RELIABILITY_NOTE, type SimulationSample } from '@tl/simulation-engine';
import { INITIAL_DEMO_BALANCE_CENTS } from '@tl/types';
import { entitlements } from '@tl/types/plans';
import { Badge, Button, Callout, Card, Progress, EmptyState } from '@tl/ui';
import { BarChart3 } from 'lucide-react';
import { formatVirtualUsd } from '@/lib/format';
import { EquityCurve } from './EquityCurve';

export const metadata: Metadata = { title: 'Estadísticas' };
export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const sims = await db.simulation.findMany({
    where: { userId: auth.user.id, openedAt: { gte: historyCutoff(auth.user.plan) } },
    orderBy: { openedAt: 'desc' },
    take: 500,
    include: { journalEntry: { select: { id: true } } },
  });

  const samples: SimulationSample[] = sims.map((s, i) => ({
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
    riskReward:
      s.stopLoss != null && s.takeProfit != null
        ? Math.abs(s.takeProfit - s.entryPrice) / Math.abs(s.entryPrice - s.stopLoss)
        : null,
    rationaleLength: s.rationale.length,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
    hasJournalEntry: Boolean(s.journalEntry),
    minutesSincePrevious: sims[i + 1]
      ? Math.round((s.openedAt.getTime() - sims[i + 1].openedAt.getTime()) / 60000)
      : null,
    strategyTag: s.strategyTag,
  }));

  const stats = computeStats(samples, INITIAL_DEMO_BALANCE_CENTS);
  const plan = entitlements(auth.user.plan);

  const closed = sims.filter((s) => s.closedAt && s.pnlCents != null).reverse();
  let running = 0;
  const curve = closed.map((s) => {
    running += s.pnlCents ?? 0;
    return { t: s.closedAt!.getTime(), value: running };
  });

  const attempts = await db.quizAttempt.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: 'asc' },
    select: { score: true, createdAt: true },
  });

  if (stats.totalSimulations === 0) {
    return (
      <div className="app-content-page mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <p className="app-page-kicker">Medir</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Estadísticas</h1>
        <Card className="mt-6">
          <EmptyState
            icon={<BarChart3 className="size-5" />}
            title="Todavía no hay datos que analizar"
            description="Cuando cierres tus primeras simulaciones aparecerán aquí tu puntuación de disciplina, tus patrones por instrumento y horario, y la evolución de tus evaluaciones."
            action={
              <Link href="/terminal">
                <Button size="sm">Ir a la terminal</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="app-content-page mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <p className="app-page-kicker">Medir</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Estadísticas</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
          El indicador principal es la disciplina, no el beneficio virtual. Un buen proceso con resultado negativo
          vale más que lo contrario.
        </p>
      </header>

      {/* Disciplina */}
      <Card className="app-discipline-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
              Puntuación de disciplina
            </p>
            <p className="num mt-1 text-4xl font-semibold tracking-tight">
              {stats.disciplineScore}
              <span className="text-lg text-[var(--color-subtle)]">/100</span>
            </p>
          </div>
          <Badge
            tone={stats.disciplineScore >= 70 ? 'positive' : stats.disciplineScore >= 45 ? 'gold' : 'negative'}
          >
            {stats.disciplineScore >= 70 ? 'Consolidada' : stats.disciplineScore >= 45 ? 'Irregular' : 'Por construir'}
          </Badge>
        </div>

        <ul className="mt-5 space-y-3">
          {stats.disciplineBreakdown.map((b) => (
            <li key={b.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px]">{b.label}</span>
                <span className="num text-[12px] text-[var(--color-muted)]">
                  {b.points} / {b.max}
                </span>
              </div>
              <Progress className="mt-1.5" value={b.points} max={b.max} label={b.label} />
              <p className="mt-1 text-[11px] text-[var(--color-subtle)]">{b.hint}</p>
            </li>
          ))}
        </ul>
      </Card>

      {/* Métricas generales */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Simulaciones" value={String(stats.totalSimulations)} hint={`${stats.closed} cerradas`} />
        <Metric
          label="Porcentaje de aciertos"
          value={`${stats.hitRatePercent} %`}
          hint={`Muestra ${stats.sampleReliability.toLowerCase()}`}
          tone={stats.sampleReliability === 'INSUFICIENTE' ? 'muted' : 'normal'}
        />
        <Metric
          label="Resultado virtual acumulado"
          value={`${stats.netPnlCents >= 0 ? '+' : ''}${formatVirtualUsd(stats.netPnlCents)}`}
          hint="VUSD, sin valor económico"
          tone={stats.netPnlCents >= 0 ? 'positive' : 'negative'}
        />
        <Metric
          label="Caída máxima"
          value={formatVirtualUsd(stats.maxDrawdownCents)}
          hint="Mayor retroceso del acumulado"
        />
      </div>

      <Callout tone="info" title="Sobre el tamaño de muestra">
        {RELIABILITY_NOTE[stats.sampleReliability]}
      </Callout>

      {/* Curva */}
      {curve.length > 1 && (
        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Evolución del resultado virtual acumulado</h2>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">
            Describe tu histórico. No anticipa nada sobre el futuro.
          </p>
          <EquityCurve points={curve} className="mt-4" />
        </Card>
      )}

      {/* Desgloses */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-[var(--color-border)] px-5 py-3.5">
            <h2 className="text-[13px] font-semibold">Por instrumento</h2>
          </div>
          <BreakdownList
            rows={stats.byAsset.map((a) => ({
              key: a.symbol,
              label: a.symbol,
              count: a.count,
              hitRate: a.hitRatePercent,
              pnl: a.netPnlCents,
            }))}
          />
        </Card>

        <Card>
          <div className="border-b border-[var(--color-border)] px-5 py-3.5">
            <h2 className="text-[13px] font-semibold">Por franja horaria (UTC)</h2>
          </div>
          <BreakdownList
            rows={stats.byHour.map((h) => ({
              key: String(h.hourUtc),
              label: `${String(h.hourUtc).padStart(2, '0')}:00`,
              count: h.count,
              hitRate: h.hitRatePercent,
              pnl: h.netPnlCents,
            }))}
          />
        </Card>
      </div>

      {plan.features.advancedStats ? (
        <Card>
          <div className="border-b border-[var(--color-border)] px-5 py-3.5">
            <h2 className="text-[13px] font-semibold">Por estrategia</h2>
          </div>
          {stats.byStrategy.length === 0 ? (
            <p className="px-5 py-6 text-center text-[13px] text-[var(--color-muted)]">
              Etiqueta tus simulaciones con una estrategia para poder compararlas entre sí.
            </p>
          ) : (
            <BreakdownList
              rows={stats.byStrategy.map((s) => ({
                key: s.tag,
                label: s.tag,
                count: s.count,
                hitRate: s.hitRatePercent,
                pnl: s.netPnlCents,
                extra: s.avgRiskReward != null ? `R:B ${s.avgRiskReward}` : undefined,
              }))}
            />
          )}
        </Card>
      ) : (
        <Card className="p-5">
          <h2 className="text-[13px] font-semibold">Análisis por estrategia</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-muted)]">
            El desglose avanzado por etiquetas de estrategia está disponible a partir del plan Standard.
          </p>
          <Link href="/precios" className="mt-3 inline-block">
            <Button size="sm" variant="outline">
              Ver planes
            </Button>
          </Link>
        </Card>
      )}

      {/* Errores repetidos */}
      {stats.repeatedMistakes.length > 0 && (
        <Card className="border-[color-mix(in_srgb,var(--color-gold)_24%,transparent)] bg-[var(--color-gold-soft)] p-5">
          <h2 className="text-[13px] font-semibold text-[var(--color-gold)]">Patrones a corregir</h2>
          <ul className="mt-3 space-y-2">
            {stats.repeatedMistakes.map((m) => (
              <li key={m} className="text-[13px] leading-relaxed text-[var(--color-muted)]">
                · {m}
              </li>
            ))}
          </ul>
          <Link href="/entrenador?tipo=diario" className="mt-4 inline-block">
            <Button size="sm" variant="secondary">
              Pedir una revisión al entrenador
            </Button>
          </Link>
        </Card>
      )}

      {/* Evolución educativa */}
      {attempts.length > 1 && (
        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Evolución en las evaluaciones</h2>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">
            Puntuación de cada intento de cuestionario, en orden cronológico.
          </p>
          <EquityCurve
            className="mt-4"
            points={attempts.map((a) => ({ t: a.createdAt.getTime(), value: a.score }))}
            tone="positive"
            suffix=" %"
          />
        </Card>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = 'normal',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'normal' | 'positive' | 'negative' | 'muted';
}) {
  const color =
    tone === 'positive'
      ? 'text-[var(--color-positive)]'
      : tone === 'negative'
        ? 'text-[var(--color-negative)]'
        : tone === 'muted'
          ? 'text-[var(--color-muted)]'
          : '';
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">{label}</p>
      <p className={`num mt-1.5 text-xl font-semibold tracking-tight ${color}`}>{value}</p>
      <p className="mt-1 text-[11px] text-[var(--color-subtle)]">{hint}</p>
    </Card>
  );
}

function BreakdownList({
  rows,
}: {
  rows: Array<{ key: string; label: string; count: number; hitRate: number; pnl: number; extra?: string }>;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-6 text-center text-[13px] text-[var(--color-muted)]">Sin datos.</p>;
  }
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {rows.slice(0, 8).map((r) => (
        <li key={r.key} className="flex items-center gap-3 px-5 py-2.5">
          <span className="num w-16 shrink-0 text-[12px] font-medium">{r.label}</span>
          <span className="num w-10 shrink-0 text-[11px] text-[var(--color-subtle)]">{r.count}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-overlay)]">
            <span
              className="block h-full rounded-full bg-[var(--color-blue)]"
              style={{ width: `${Math.min(100, r.hitRate)}%` }}
            />
          </span>
          <span className="num w-12 shrink-0 text-right text-[11px] text-[var(--color-muted)]">
            {r.hitRate} %
          </span>
          {r.extra && <span className="num w-14 shrink-0 text-right text-[10px] text-[var(--color-subtle)]">{r.extra}</span>}
          <span
            className={`num w-20 shrink-0 text-right text-[11px] ${
              r.pnl > 0
                ? 'text-[var(--color-positive)]'
                : r.pnl < 0
                  ? 'text-[var(--color-negative)]'
                  : 'text-[var(--color-muted)]'
            }`}
          >
            {r.pnl >= 0 ? '+' : ''}
            {formatVirtualUsd(r.pnl)}
          </span>
        </li>
      ))}
    </ul>
  );
}
