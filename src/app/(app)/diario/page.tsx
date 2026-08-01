import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import { historyCutoff } from '@/lib/entitlements';
import { getSymbol } from '@tl/market-data';
import { JournalView } from './JournalView';

export const metadata: Metadata = { title: 'Diario educativo' };
export const dynamic = 'force-dynamic';

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ simulacion?: string }>;
}) {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const params = await searchParams;

  const [entries, pendingSimulations, preselected] = await Promise.all([
    db.journalEntry.findMany({
      where: { userId: auth.user.id, createdAt: { gte: historyCutoff(auth.user.plan) } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        simulation: {
          select: {
            id: true,
            symbol: true,
            direction: true,
            outcome: true,
            pnlCents: true,
            stakeCents: true,
            entryPrice: true,
            exitPrice: true,
            stopLoss: true,
            leverage: true,
          },
        },
      },
    }),
    // Simulaciones cerradas sin entrada de diario: son las que conviene documentar.
    db.simulation.findMany({
      where: { userId: auth.user.id, status: 'CLOSED', journalEntry: null },
      orderBy: { closedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        symbol: true,
        direction: true,
        outcome: true,
        pnlCents: true,
        rationale: true,
        closedAt: true,
        stopLoss: true,
      },
    }),
    params.simulacion
      ? db.simulation.findFirst({
          where: { id: params.simulacion, userId: auth.user.id },
          select: { id: true, symbol: true, direction: true, rationale: true, outcome: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <JournalView
      entries={entries.map((e) => ({
        id: e.id,
        title: e.title,
        hypothesis: e.hypothesis,
        entryReason: e.entryReason,
        emotionBefore: e.emotionBefore,
        emotionAfter: e.emotionAfter,
        riskLevel: e.riskLevel,
        indicatorsUsed: fromJson<string[]>(e.indicatorsUsed, []),
        result: e.result,
        mistake: e.mistake,
        lesson: e.lesson,
        tags: fromJson<string[]>(e.tags, []),
        createdAt: e.createdAt.toISOString(),
        simulation: e.simulation
          ? {
              ...e.simulation,
              precision: getSymbol(e.simulation.symbol)?.precision ?? 2,
            }
          : null,
      }))}
      pending={pendingSimulations.map((s) => ({
        id: s.id,
        symbol: s.symbol,
        direction: s.direction,
        outcome: s.outcome,
        pnlCents: s.pnlCents,
        rationale: s.rationale,
        closedAt: s.closedAt?.toISOString() ?? null,
        hadStopLoss: s.stopLoss != null,
      }))}
      preselected={preselected}
      timezone={auth.user.timezone}
    />
  );
}
