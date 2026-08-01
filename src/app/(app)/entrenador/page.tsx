import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import { getUsage, allowedIndicators } from '@/lib/entitlements';
import { entitlements } from '@tl/types/plans';
import { SYMBOLS } from '@tl/market-data';
import { isAIConfigured } from '@tl/ai';
import { CoachView } from './CoachView';
import type { AIEducationalAnalysis } from '@tl/types';

export const metadata: Metadata = { title: 'Entrenador educativo' };
export const dynamic = 'force-dynamic';

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; tf?: string; tipo?: string }>;
}) {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const params = await searchParams;
  const plan = entitlements(auth.user.plan);

  const [usage, history, closedSims] = await Promise.all([
    getUsage(auth.user.id),
    db.aIAnalysis.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.simulation.findMany({
      where: { userId: auth.user.id, status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      take: 15,
      select: { id: true, symbol: true, direction: true, outcome: true, closedAt: true, pnlCents: true },
    }),
  ]);

  const used = plan.aiAnalysesPerDay != null ? usage.aiCallsToday : usage.aiCallsThisMonth;
  const limit = plan.aiAnalysesPerDay ?? plan.aiAnalysesPerMonth;

  return (
    <CoachView
      symbols={SYMBOLS.map((s) => ({ symbol: s.symbol, name: s.name, minPlan: s.minPlan }))}
      defaultSymbol={(params.symbol ?? 'EURUSD').toUpperCase()}
      defaultTimeframe={params.tf ?? '1h'}
      defaultKind={params.tipo === 'diario' ? 'JOURNAL_REVIEW' : 'CHART_REVIEW'}
      availableIndicators={allowedIndicators(auth.user.plan)}
      usage={{ used, limit, period: plan.aiAnalysesPerDay != null ? 'diario' : 'mensual', planName: plan.name }}
      multiTimeframe={plan.features.multiTimeframeAI}
      aiConfigured={isAIConfigured()}
      history={history.map((h) => ({
        id: h.id,
        kind: h.kind,
        symbol: h.symbol,
        engine: h.engine,
        createdAt: h.createdAt.toISOString(),
        flagged: h.flagged,
        analysis: fromJson<AIEducationalAnalysis | null>(h.payload, null),
      }))}
      closedSimulations={closedSims.map((s) => ({
        id: s.id,
        symbol: s.symbol,
        direction: s.direction,
        outcome: s.outcome,
        closedAt: s.closedAt?.toISOString() ?? null,
        pnlCents: s.pnlCents,
      }))}
    />
  );
}
