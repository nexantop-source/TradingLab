import type { Metadata } from 'next';
import { MarketOverview } from '@/components/investment/MarketOverview';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Flame,
  Target,
  ShieldCheck,
  BookOpen,
  CalendarDays,
} from 'lucide-react';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensureDemoAccount, dailyChangeCents } from '@/lib/demo-account';
import { settleDueSimulations, listOpenPositions } from '@/lib/simulation-service';
import { getUsage } from '@/lib/entitlements';
import { marketData, getEconomicEvents, listNews, getSymbol } from '@tl/market-data';
import { computeStats, RELIABILITY_NOTE, type SimulationSample } from '@tl/simulation-engine';
import { INITIAL_DEMO_BALANCE_CENTS } from '@tl/types';
import { entitlements } from '@tl/types/plans';
import { Badge, Card, Delta, Progress, Button, EmptyState } from '@tl/ui';
import { VirtualBalance } from '@tl/ui/compliance';
import { DataProvenanceBadge } from '@tl/ui/DataProvenanceBadge';
import { AdSlot } from '@/components/AdSlot';
import { formatVirtualUsd, formatRelative, formatDateTime } from '@/lib/format';
import { levelFromXp } from '@/content/gamification';

export const metadata: Metadata = { title: 'Panel' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');
  if (!auth.user.onboardingCompleted) redirect('/onboarding');

  const { user } = auth;

  // Liquida vencimientos antes de mostrar cifras, para que el saldo sea real.
  await settleDueSimulations(user.id);

  const account = await ensureDemoAccount(user.id);
  const provider = marketData();

  const [
    dailyChange,
    openPositions,
    recentClosed,
    watchlist,
    progressRows,
    nextLesson,
    usage,
    userRow,
    challenges,
  ] = await Promise.all([
    dailyChangeCents(account.id),
    listOpenPositions(user.id),
    db.simulation.findMany({
      where: { userId: user.id, status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      take: 5,
    }),
    db.watchlistItem.findMany({ where: { userId: user.id }, orderBy: { position: 'asc' }, take: 6 }),
    db.userProgress.findMany({ where: { userId: user.id }, select: { lessonId: true, status: true } }),
    findNextLesson(user.id),
    getUsage(user.id),
    db.user.findUnique({ where: { id: user.id }, select: { streakDays: true, xp: true, level: true } }),
    db.challengeEntry.findMany({
      where: { userId: user.id, completedAt: null },
      include: { challenge: true },
      take: 3,
    }),
  ]);

  const [quotes, allSims, totalLessons] = await Promise.all([
    provider.getQuotes([...new Set(['SPY', 'BTCUSD', 'EURUSD', 'QQQ', ...watchlist.map((w) => w.symbol)])]),
    db.simulation.findMany({
      where: { userId: user.id },
      orderBy: { openedAt: 'desc' },
      take: 200,
      include: { journalEntry: { select: { id: true } } },
    }),
    db.lesson.count({ where: { published: true } }),
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
    riskReward:
      s.stopLoss != null && s.takeProfit != null
        ? Math.abs(s.takeProfit - s.entryPrice) / Math.abs(s.entryPrice - s.stopLoss)
        : null,
    rationaleLength: s.rationale.length,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
    hasJournalEntry: Boolean(s.journalEntry),
    minutesSincePrevious: allSims[i + 1]
      ? Math.round((s.openedAt.getTime() - allSims[i + 1].openedAt.getTime()) / 60000)
      : null,
    strategyTag: s.strategyTag,
  }));

  const stats = computeStats(samples, INITIAL_DEMO_BALANCE_CENTS);
  const completedLessons = progressRows.filter((p) => p.status === 'COMPLETED').length;
  const events = getEconomicEvents(Date.now(), Date.now() + 5 * 86400000).slice(0, 4);
  const news = listNews({ limit: 3 });
  const plan = entitlements(user.plan);
  const levelInfo = levelFromXp(userRow?.xp ?? 0);
  const health = await provider.healthCheck();

  return (
    <div className="app-content-page mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="app-page-kicker">Hola, {user.name.split(' ')[0]}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Todo tu espacio, de un vistazo.</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--color-muted)]">Tu saldo demo, tus mercados y tu progreso. Elige dónde quieres poner el foco hoy.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/terminal">
            <Button size="sm">
              Abrir la terminal
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </Link>
          <Link href="/entrenador">
            <Button size="sm" variant="secondary">
              Pedir un análisis
            </Button>
          </Link>
        </div>
      </header>

      <MarketOverview lessonHref={nextLesson ? `/academia/leccion/${nextLesson.slug}` : '/academia'} markets={quotes.slice(0, 4).map(q => ({ symbol: q.symbol, name: getSymbol(q.symbol)?.name ?? q.symbol, assetClass: getSymbol(q.symbol)?.assetClass ?? 'STOCK', precision: getSymbol(q.symbol)?.precision ?? 2, price: q.price, change: q.changePercent }))} />

      {/* ── Fila superior ────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
        <Card elevated className="p-5">
          <VirtualBalance cents={account.balanceCents} size="xl" />
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[var(--color-border)] pt-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">Variación 24 h</p>
              <Delta value={(dailyChange / INITIAL_DEMO_BALANCE_CENTS) * 100} size="lg" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">Resultado virtual</p>
              <p className="num text-sm font-medium">
                {dailyChange >= 0 ? '+' : ''}
                {formatVirtualUsd(dailyChange)} VUSD
              </p>
            </div>
            <div className="ml-auto">
              <DataProvenanceBadge
                provenance={{
                  provider: provider.id,
                  providerLabel: provider.label,
                  sourceTimestamp: Date.now(),
                  receivedTimestamp: Date.now(),
                  latencyMs: health.latencyMs,
                  freshness: provider.synthetic ? 'SIMULATED' : 'REALTIME',
                  marketStatus: 'OPEN',
                  currency: 'USD',
                  synthetic: provider.synthetic,
                  notice: health.message,
                }}
              />
            </div>
          </div>
        </Card>

        <DisciplineCard score={stats.disciplineScore} breakdown={stats.disciplineBreakdown} />

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-[var(--color-gold)]" aria-hidden="true" />
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
              Racha de aprendizaje
            </p>
          </div>
          <p className="num mt-2 text-3xl font-semibold tracking-tight">{userRow?.streakDays ?? 0}</p>
          <p className="text-[12px] text-[var(--color-muted)]">
            {userRow?.streakDays === 1 ? 'día consecutivo' : 'días consecutivos'}
          </p>

          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                Nivel {levelInfo.level}
              </p>
              <p className="num text-[11px] text-[var(--color-muted)]">
                {userRow?.xp ?? 0}
                {levelInfo.next ? ` / ${levelInfo.next}` : ''} XP
              </p>
            </div>
            <Progress
              className="mt-2"
              tone="gold"
              value={levelInfo.next ? (userRow?.xp ?? 0) - levelInfo.current : 1}
              max={levelInfo.next ? levelInfo.next - levelInfo.current : 1}
              label="Progreso hacia el siguiente nivel"
            />
          </div>
        </Card>
      </div>

      {/* ── Cuerpo ───────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {/* Simulaciones abiertas */}
          <Card>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
              <h2 className="text-[13px] font-semibold">Simulaciones abiertas</h2>
              <Badge tone={openPositions.length ? 'blue' : 'neutral'}>{openPositions.length}</Badge>
            </div>
            {openPositions.length === 0 ? (
              <EmptyState
                icon={<Target className="size-5" />}
                title="No tienes simulaciones abiertas"
                description="Abre la terminal, elige un instrumento y formula tu primera hipótesis del día. Recuerda escribir qué la invalidaría."
                action={
                  <Link href="/terminal">
                    <Button size="sm">Ir a la terminal</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {openPositions.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="num flex items-center gap-2 text-[13px] font-medium">
                        {p.symbol}
                        <Badge tone={p.direction === 'BEARISH' ? 'negative' : 'positive'}>
                          {p.direction === 'BEARISH' ? 'Bajista' : 'Alcista'}
                        </Badge>
                        {p.leverage > 1 && <Badge tone="gold">{p.leverage}:1</Badge>}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-[var(--color-subtle)]">
                        Entrada {p.entryPrice.toFixed(p.precision)} · {formatRelative(p.openedAt)}
                        {p.expiresAt ? ` · vence ${formatRelative(p.expiresAt)}` : ''}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="num block text-[13px] font-medium">
                        {p.currentPrice.toFixed(p.precision)}
                      </span>
                      <Delta value={p.unrealizedPercent} size="sm" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Historial reciente */}
          <Card>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
              <h2 className="text-[13px] font-semibold">Simulaciones recientes</h2>
              <Link href="/diario" className="text-[12px] text-[var(--color-blue)] hover:underline">
                Ver el diario
              </Link>
            </div>
            {recentClosed.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-[var(--color-muted)]">
                Aquí aparecerán tus simulaciones cerradas.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {recentClosed.map((s) => {
                  const meta = getSymbol(s.symbol);
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="num text-[13px] font-medium">{s.symbol}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--color-subtle)]">
                          {s.rationale.slice(0, 70)}…
                        </span>
                      </span>
                      <span className="text-right">
                        <span
                          className={`num block text-[13px] font-medium ${
                            (s.pnlCents ?? 0) > 0
                              ? 'text-[var(--color-positive)]'
                              : (s.pnlCents ?? 0) < 0
                                ? 'text-[var(--color-negative)]'
                                : 'text-[var(--color-muted)]'
                          }`}
                        >
                          {(s.pnlCents ?? 0) >= 0 ? '+' : ''}
                          {formatVirtualUsd(s.pnlCents ?? 0)}
                        </span>
                        <span className="text-[10px] text-[var(--color-subtle)]">
                          {s.stopLoss != null ? 'con stop loss' : 'sin stop loss'}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Reconocimientos de proceso, no de beneficio */}
          {stats.totalSimulations > 0 && (
            <Card className="p-5">
              <h2 className="text-[13px] font-semibold">Lo que estás haciendo bien</h2>
              <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                Estas cifras describen tu proceso. La rentabilidad virtual, con {stats.closed} simulaciones
                cerradas, no permite concluir nada todavía.
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <ProcessStat label="Uso de stop loss" value={`${stats.stopLossUsagePercent} %`} good={stats.stopLossUsagePercent >= 60} />
                <ProcessStat label="Riesgo medio" value={`${stats.averageRiskPercent} %`} good={stats.averageRiskPercent <= 2} />
                <ProcessStat
                  label="Riesgo-beneficio"
                  value={stats.averageRiskReward != null ? String(stats.averageRiskReward) : '—'}
                  good={(stats.averageRiskReward ?? 0) >= 1.5}
                />
                <ProcessStat label="Diario" value={`${stats.journalCoveragePercent} %`} good={stats.journalCoveragePercent >= 60} />
              </dl>
              {stats.repeatedMistakes.length > 0 && (
                <div className="mt-4 rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--color-gold)_24%,transparent)] bg-[var(--color-gold-soft)] p-3">
                  <p className="text-[11px] font-semibold text-[var(--color-gold)]">Patrones a corregir</p>
                  <ul className="mt-1.5 space-y-1">
                    {stats.repeatedMistakes.slice(0, 2).map((m) => (
                      <li key={m} className="text-[12px] leading-relaxed text-[var(--color-muted)]">
                        · {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-subtle)]">
                {RELIABILITY_NOTE[stats.sampleReliability]}
              </p>
            </Card>
          )}
        </div>

        {/* ── Columna derecha ────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Próxima lección */}
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-[var(--color-blue)]" aria-hidden="true" />
              <h2 className="text-[13px] font-semibold">Tu ruta educativa</h2>
            </div>
            <Progress
              className="mt-3"
              value={completedLessons}
              max={Math.max(totalLessons, 1)}
              label="Progreso de la academia"
            />
            <p className="num mt-2 text-[11px] text-[var(--color-muted)]">
              {completedLessons} de {totalLessons} lecciones completadas
            </p>
            {nextLesson ? (
              <Link
                href={`/academia/leccion/${nextLesson.slug}`}
                className="mt-4 block rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 transition-colors hover:border-[var(--color-blue)]"
              >
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">Siguiente lección</p>
                <p className="mt-1 text-[13px] font-medium">{nextLesson.title}</p>
                <p className="num mt-1 text-[10px] text-[var(--color-subtle)]">
                  {nextLesson.estimatedMinutes} min
                </p>
              </Link>
            ) : (
              <p className="mt-4 text-[12px] text-[var(--color-muted)]">
                Has completado todas las lecciones disponibles. Pronto añadiremos más contenido.
              </p>
            )}
          </Card>

          <AdSlot code="dashboard-side" page="dashboard" plan={auth.user.plan} />

          {/* Mercados observados */}
          <Card>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <h2 className="text-[13px] font-semibold">Mercados observados</h2>
              <Link href="/terminal" className="text-[11px] text-[var(--color-blue)] hover:underline">
                Terminal
              </Link>
            </div>
            <ul className="divide-y divide-[var(--color-border)]">
              {quotes.map((q) => {
                const meta = getSymbol(q.symbol);
                return (
                  <li key={q.symbol}>
                    <Link
                      href={`/terminal?symbol=${q.symbol}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-[var(--color-overlay)]"
                    >
                      <span className="min-w-0">
                        <span className="num block text-[12px] font-medium">{q.symbol}</span>
                        <span className="block truncate text-[10px] text-[var(--color-subtle)]">
                          {meta?.name}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="num block text-[12px]">{q.price.toFixed(meta?.precision ?? 2)}</span>
                        <Delta value={q.changePercent} size="sm" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Eventos económicos */}
          <Card>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                <CalendarDays className="size-3.5 text-[var(--color-muted)]" aria-hidden="true" />
                Próximos eventos
              </h2>
              <Link href="/calendario" className="text-[11px] text-[var(--color-blue)] hover:underline">
                Ver todo
              </Link>
            </div>
            <ul className="divide-y divide-[var(--color-border)]">
              {events.map((e) => (
                <li key={e.id} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-medium leading-snug">{e.title}</p>
                    <Badge tone={e.impact === 'HIGH' ? 'negative' : e.impact === 'MEDIUM' ? 'gold' : 'neutral'}>
                      {e.impact === 'HIGH' ? 'Alto' : e.impact === 'MEDIUM' ? 'Medio' : 'Bajo'}
                    </Badge>
                  </div>
                  <p className="num mt-1 text-[10px] text-[var(--color-subtle)]">
                    {formatDateTime(e.time, user.timezone)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          {/* Retos activos */}
          {challenges.length > 0 && (
            <Card>
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                <h2 className="text-[13px] font-semibold">Retos en curso</h2>
                <Link href="/retos" className="text-[11px] text-[var(--color-blue)] hover:underline">
                  Ver todos
                </Link>
              </div>
              <ul className="divide-y divide-[var(--color-border)]">
                {challenges.map((c) => (
                  <li key={c.id} className="px-4 py-3">
                    <p className="text-[12px] font-medium">{c.challenge.title}</p>
                    <Progress
                      className="mt-2"
                      tone="violet"
                      value={c.progress}
                      max={c.challenge.target}
                      label={c.challenge.title}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Uso del plan */}
          <Card className="p-4">
            <h2 className="text-[13px] font-semibold">Tu plan {plan.name}</h2>
            <dl className="mt-3 space-y-2 text-[12px]">
              <UsageRow
                label="Simulaciones hoy"
                used={usage.simulationsToday}
                limit={plan.simulationsPerDay}
              />
              <UsageRow
                label="Análisis con IA"
                used={plan.aiAnalysesPerDay != null ? usage.aiCallsToday : usage.aiCallsThisMonth}
                limit={plan.aiAnalysesPerDay ?? plan.aiAnalysesPerMonth}
                suffix={plan.aiAnalysesPerDay != null ? 'hoy' : 'este mes'}
              />
              <UsageRow label="Reinicios de saldo" used={usage.balanceResetsThisMonth} limit={plan.balanceResetsPerMonth} />
            </dl>
            {user.plan !== 'PREMIUM' && (
              <Link href="/precios" className="mt-4 block">
                <Button size="sm" variant="outline" fullWidth>
                  Comparar planes
                </Button>
              </Link>
            )}
          </Card>

          {/* Artículos */}
          <Card>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <h2 className="text-[13px] font-semibold">Para leer</h2>
              <Link href="/noticias" className="text-[11px] text-[var(--color-blue)] hover:underline">
                Ver todo
              </Link>
            </div>
            <ul className="divide-y divide-[var(--color-border)]">
              {news.map((n) => (
                <li key={n.id}>
                  <Link href={`/noticias/${n.slug}`} className="block px-4 py-3 hover:bg-[var(--color-overlay)]">
                    <p className="text-[12px] font-medium leading-snug">{n.title}</p>
                    <p className="num mt-1 text-[10px] text-[var(--color-subtle)]">{n.readingMinutes} min de lectura</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <AdSlot code="dashboard-banner" page="dashboard" plan={auth.user.plan} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function DisciplineCard({
  score,
  breakdown,
}: {
  score: number;
  breakdown: Array<{ label: string; points: number; max: number; hint: string }>;
}) {
  const tone = score >= 70 ? 'positive' : score >= 45 ? 'gold' : 'negative';
  const color =
    tone === 'positive'
      ? 'var(--color-positive)'
      : tone === 'gold'
        ? 'var(--color-gold)'
        : 'var(--color-negative)';

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4" style={{ color }} aria-hidden="true" />
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
          Puntuación de disciplina
        </p>
      </div>
      <p className="num mt-2 text-3xl font-semibold tracking-tight" style={{ color }}>
        {score}
        <span className="text-base text-[var(--color-subtle)]">/100</span>
      </p>
      <p className="mt-1 text-[11px] leading-snug text-[var(--color-muted)]">
        Mide tu proceso, no tu beneficio virtual.
      </p>

      <ul className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-3">
        {breakdown.slice(0, 3).map((b) => (
          <li key={b.label} title={b.hint}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-[var(--color-muted)]">{b.label}</span>
              <span className="num text-[11px] text-[var(--color-subtle)]">
                {b.points}/{b.max}
              </span>
            </div>
            <Progress className="mt-1" value={b.points} max={b.max} tone="blue" label={b.label} />
          </li>
        ))}
      </ul>
      <Link href="/estadisticas" className="mt-3 block text-[11px] text-[var(--color-blue)] hover:underline">
        Ver el desglose completo
      </Link>
    </Card>
  );
}

function ProcessStat({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">{label}</dt>
      <dd
        className={`num mt-1 text-lg font-semibold ${
          good ? 'text-[var(--color-positive)]' : 'text-[var(--color-muted)]'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function UsageRow({
  label,
  used,
  limit,
  suffix,
}: {
  label: string;
  used: number;
  limit: number | null;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-[var(--color-muted)]">
          {label}
          {suffix ? ` (${suffix})` : ''}
        </dt>
        <dd className="num text-[var(--color-text)]">
          {used}
          {limit != null ? ` / ${limit}` : ' · sin límite fijo'}
        </dd>
      </div>
      {limit != null && <Progress className="mt-1" value={used} max={limit} tone={used >= limit ? 'gold' : 'blue'} label={label} />}
    </div>
  );
}

async function findNextLesson(userId: string) {
  const completed = await db.userProgress.findMany({
    where: { userId, status: 'COMPLETED' },
    select: { lessonId: true },
  });
  const done = new Set(completed.map((c) => c.lessonId));

  const lessons = await db.lesson.findMany({
    where: { published: true },
    orderBy: [{ position: 'asc' }],
    include: { module: { include: { course: { include: { track: true } } } } },
  });

  const ordered = lessons.sort((a, b) => {
    const ta = a.module.course.track.position;
    const tb = b.module.course.track.position;
    if (ta !== tb) return ta - tb;
    return a.position - b.position;
  });

  return ordered.find((l) => !done.has(l.id)) ?? null;
}
