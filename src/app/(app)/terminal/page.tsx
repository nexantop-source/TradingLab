import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensureDemoAccount } from '@/lib/demo-account';
import { listOpenPositions, settleDueSimulations } from '@/lib/simulation-service';
import { getUsage, allowedIndicators } from '@/lib/entitlements';
import { marketData, getSymbol, SYMBOLS, getEventsForSymbol } from '@tl/market-data';
import { entitlements } from '@tl/types/plans';
import { Terminal } from './Terminal';
import { fromJson } from '@/lib/json';

export const metadata: Metadata = { title: 'Terminal de simulación' };
export const dynamic = 'force-dynamic';

export default async function TerminalPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; tf?: string }>;
}) {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');
  if (!auth.user.onboardingCompleted) redirect('/onboarding');

  const { user } = auth;
  const params = await searchParams;

  await settleDueSimulations(user.id);

  const requested = (params.symbol ?? 'BTCUSD').toUpperCase();
  const meta = getSymbol(requested) ?? getSymbol('BTCUSD')!;
  const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const;
  const timeframe = timeframes.find(value => value === params.tf) ?? '1h';

  const provider = marketData();
  const account = await ensureDemoAccount(user.id);

  const [series, quote, watchlistRows, openPositions, usage, closedRecent, portfolios] = await Promise.all([
    provider.getCandles({ symbol: meta.symbol, timeframe, limit: 400 }),
    provider.getQuote(meta.symbol),
    db.watchlistItem.findMany({ where: { userId: user.id }, orderBy: [{ favorite: 'desc' }, { position: 'asc' }] }),
    listOpenPositions(user.id),
    getUsage(user.id),
    db.simulation.findMany({
      where: { userId: user.id, status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      take: 25,
    }),
    db.portfolio.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ]);

  const watchQuotes = await provider.getQuotes(watchlistRows.map((w) => w.symbol));
  const byWatchSymbol = new Map(watchQuotes.map((q) => [q.symbol, q]));

  const events = getEventsForSymbol(meta.symbol, Date.now() - 3 * 86400000, Date.now() + 7 * 86400000);

  // Marcadores de simulaciones sobre este instrumento, para el gráfico.
  const markers = [
    ...openPositions
      .filter((p) => p.symbol === meta.symbol)
      .map((p) => ({
        id: p.id,
        time: new Date(p.openedAt).getTime(),
        price: p.entryPrice,
        direction: (p.direction ?? 'BULLISH') as 'BULLISH' | 'BEARISH',
        label: 'Entrada',
        kind: 'ENTRY' as const,
      })),
    ...closedRecent
      .filter((s) => s.symbol === meta.symbol && s.exitPrice != null)
      .flatMap((s) => [
        {
          id: `${s.id}-in`,
          time: s.openedAt.getTime(),
          price: s.entryPrice,
          direction: (s.direction ?? 'BULLISH') as 'BULLISH' | 'BEARISH',
          label: 'Entrada',
          kind: 'ENTRY' as const,
        },
        {
          id: `${s.id}-out`,
          time: (s.closedAt ?? s.openedAt).getTime(),
          price: s.exitPrice!,
          direction: (s.direction ?? 'BULLISH') as 'BULLISH' | 'BEARISH',
          label: 'Salida',
          kind: 'EXIT' as const,
        },
      ]),
  ];

  const plan = entitlements(user.plan);

  return (
    <Terminal
      key={meta.symbol}
      user={user}
      balanceCents={account.balanceCents}
      symbol={{
        symbol: meta.symbol,
        name: meta.name,
        assetClass: meta.assetClass,
        precision: meta.precision,
        spreadBps: meta.spreadBps,
        sessionLabel: meta.session.label,
        educationalRisk: meta.educationalRisk,
        description: meta.description,
      }}
      timeframe={timeframe}
      initialCandles={series.candles}
      provenance={series.provenance}
      quote={{
        price: quote.price,
        bid: quote.bid,
        ask: quote.ask,
        changePercent: quote.changePercent,
        dayHigh: quote.dayHigh,
        dayLow: quote.dayLow,
      }}
      watchlist={watchlistRows.map((w) => {
        const q = byWatchSymbol.get(w.symbol);
        const m = getSymbol(w.symbol);
        return {
          symbol: w.symbol,
          name: m?.name ?? w.symbol,
          assetClass: m?.assetClass ?? 'FOREX',
          precision: m?.precision ?? 2,
          favorite: w.favorite,
          price: q?.price ?? 0,
          changePercent: q?.changePercent ?? 0,
          marketStatus: q?.provenance.marketStatus ?? 'CLOSED',
        };
      })}
      catalog={SYMBOLS.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        assetClass: s.assetClass,
        minPlan: s.minPlan,
      }))}
      openPositions={openPositions}
      closedRecent={closedRecent.map((s) => ({
        id: s.id,
        symbol: s.symbol,
        direction: s.direction,
        mode: s.mode,
        outcome: s.outcome,
        entryPrice: s.entryPrice,
        exitPrice: s.exitPrice,
        pnlCents: s.pnlCents,
        stakeCents: s.stakeCents,
        closedAt: s.closedAt?.toISOString() ?? null,
        closeReason: s.closeReason,
        rationale: s.rationale,
        audit: fromJson<string[]>(s.settlementAudit, []),
        precision: getSymbol(s.symbol)?.precision ?? 2,
      }))}
      markers={markers}
      events={events.map((e) => ({ time: e.time, title: e.title, impact: e.impact }))}
      availableIndicators={allowedIndicators(user.plan)}
      entitlements={{
        modes: plan.simulationModes,
        simulationsPerDay: plan.simulationsPerDay,
        simulationsUsedToday: usage.simulationsToday,
        planName: plan.name,
      }}
      portfolios={portfolios}
      marketStatus={quote.provenance.marketStatus}
    />
  );
}
