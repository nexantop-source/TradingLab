'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Star, X, Maximize2, ChevronUp } from 'lucide-react';
import type { Candle, DataProvenance, IndicatorId, SessionUser, Timeframe } from '@tl/types';
import { TIMEFRAMES } from '@tl/types';
import {
  Badge,
  Button,
  Delta,
  Input,
  Segmented,
  Tabs,
  cn,
  PriceChart,
  ChartAttribution,
  DataProvenanceBadge,
  type ChartType,
  type TradeMarker,
  type EventMarker,
} from '@tl/ui';
import { DemoBadge } from '@tl/ui/compliance';
import { INDICATORS } from '@tl/market-data/indicators';
import { MARKET_STATUS_LABEL } from '@tl/market-data/market-hours';
import { formatVirtualUsd, formatRelative } from '@/lib/format';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import type { OpenPositionDto } from '@/lib/simulation-service';
import { SimulationPanel } from './SimulationPanel';

export interface TerminalSymbol {
  symbol: string;
  name: string;
  assetClass: string;
  precision: number;
  spreadBps: number;
  sessionLabel: string;
  educationalRisk: number;
  description: string;
}

interface WatchItem {
  symbol: string;
  name: string;
  assetClass: string;
  precision: number;
  favorite: boolean;
  price: number;
  changePercent: number;
  marketStatus: string;
}

interface ClosedItem {
  id: string;
  symbol: string;
  direction: string | null;
  mode: string;
  outcome: string;
  entryPrice: number;
  exitPrice: number | null;
  pnlCents: number | null;
  stakeCents: number;
  closedAt: string | null;
  closeReason: string | null;
  rationale: string;
  audit: string[];
  precision: number;
}

export interface TerminalProps {
  user: SessionUser;
  balanceCents: number;
  symbol: TerminalSymbol;
  timeframe: Timeframe;
  initialCandles: Candle[];
  provenance: DataProvenance;
  quote: { price: number; bid: number; ask: number; changePercent: number; dayHigh: number; dayLow: number };
  watchlist: WatchItem[];
  catalog: Array<{ symbol: string; name: string; assetClass: string; minPlan: string }>;
  openPositions: OpenPositionDto[];
  closedRecent: ClosedItem[];
  markers: TradeMarker[];
  events: EventMarker[];
  availableIndicators: IndicatorId[];
  entitlements: {
    modes: Array<'HYPOTHESIS' | 'POSITION' | 'PORTFOLIO'>;
    simulationsPerDay: number | null;
    simulationsUsedToday: number;
    planName: string;
  };
  portfolios: Array<{ id: string; name: string }>;
  marketStatus: string;
}

const CHART_TYPES: Array<{ value: ChartType; label: string; title: string }> = [
  { value: 'candles', label: 'Velas', title: 'Gráfico de velas japonesas' },
  { value: 'line', label: 'Línea', title: 'Gráfico de línea sobre el cierre' },
  { value: 'area', label: 'Área', title: 'Gráfico de área sobre el cierre' },
  { value: 'heikin-ashi', label: 'HA', title: 'Velas Heikin-Ashi' },
];

export function Terminal(props: TerminalProps) {
  const router = useRouter();
  const [chartType, setChartType] = React.useState<ChartType>('candles');
  const [timeframe, setTimeframe] = React.useState<Timeframe>(props.timeframe);
  const [candles, setCandles] = React.useState<Candle[]>(props.initialCandles);
  const [provenance, setProvenance] = React.useState<DataProvenance>(props.provenance);
  const [quote, setQuote] = React.useState(props.quote);
  const [indicators, setIndicators] = React.useState<IndicatorId[]>(
    props.availableIndicators.includes('SMA20') ? ['SMA20'] : [],
  );
  const [showIndicatorMenu, setShowIndicatorMenu] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [bottomTab, setBottomTab] = React.useState<
    'open' | 'history' | 'journal' | 'analysis' | 'notes'
  >('open');
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [openPositions, setOpenPositions] = React.useState(props.openPositions);
  const [balanceCents, setBalanceCents] = React.useState(props.balanceCents);
  const [levels, setLevels] = React.useState<Array<{ price: number; label: string; tone: 'positive' | 'negative' | 'neutral' }>>([]);
  const [toast, setToast] = React.useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  // ── Refresco periódico de cotización y velas ────────────────────────────
  const refresh = React.useCallback(async () => {
    try {
      const data = await apiFetch<{
        candles: Candle[];
        provenance: DataProvenance;
      }>(`/api/market/candles?symbol=${props.symbol.symbol}&timeframe=${timeframe}&limit=400`);
      setCandles(data.candles);
      setProvenance(data.provenance);

      const q = await apiFetch<{ quotes: Array<typeof props.quote & { symbol: string }> }>(
        `/api/market/quotes?symbols=${props.symbol.symbol}`,
      );
      const first = q.quotes[0];
      if (first) setQuote(first);
    } catch {
      /* Un fallo puntual de red no debe vaciar el gráfico. */
    }
  }, [props.symbol.symbol, timeframe]);

  React.useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const filteredWatchlist = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return props.watchlist;
    return props.watchlist.filter(
      (w) => w.symbol.toLowerCase().includes(q) || w.name.toLowerCase().includes(q),
    );
  }, [props.watchlist, search]);

  const catalogMatches = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const inWatch = new Set(props.watchlist.map((w) => w.symbol));
    return props.catalog
      .filter((c) => !inWatch.has(c.symbol))
      .filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [props.catalog, props.watchlist, search]);

  function selectSymbol(symbol: string) {
    router.push(`/terminal?symbol=${symbol}&tf=${timeframe}`);
  }

  function changeTimeframe(tf: Timeframe) {
    setTimeframe(tf);
    router.replace(`/terminal?symbol=${props.symbol.symbol}&tf=${tf}`, { scroll: false });
  }

  async function closePosition(id: string, fraction = 1) {
    try {
      const result = await apiFetch<{ pnlCents: number; balanceCents: number; outcome: string; closeReason: string }>(
        `/api/simulations/${id}/close`,
        { method: 'POST', json: { fraction } },
      );
      setBalanceCents(result.balanceCents);
      setOpenPositions((prev) => (fraction >= 1 ? prev.filter((p) => p.id !== id) : prev));
      setToast({
        tone: 'ok',
        text: `Simulación cerrada. Resultado virtual: ${result.pnlCents >= 0 ? '+' : ''}${formatVirtualUsd(result.pnlCents)} VUSD.`,
      });
      router.refresh();
    } catch (err) {
      setToast({
        tone: 'error',
        text: err instanceof ApiRequestError ? err.message : 'No se ha podido cerrar la simulación.',
      });
    }
  }

  const marketClosed = props.marketStatus === 'CLOSED' || props.marketStatus === 'HOLIDAY';

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh">
      {/* ── Barra superior ───────────────────────────────────────────────── */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="num text-sm font-semibold">{props.symbol.symbol}</span>
          <span className="hidden text-[11px] text-[var(--color-muted)] sm:inline">{props.symbol.name}</span>
        </div>

        <span className="num text-base font-semibold">{quote.price.toFixed(props.symbol.precision)}</span>
        <Delta value={quote.changePercent} />

        <span className="hidden items-center gap-1.5 text-[10px] text-[var(--color-subtle)] md:flex">
          <span className="num">máx {quote.dayHigh.toFixed(props.symbol.precision)}</span>
          <span className="num">mín {quote.dayLow.toFixed(props.symbol.precision)}</span>
        </span>

        <Badge tone={marketClosed ? 'neutral' : 'positive'}>
          {MARKET_STATUS_LABEL[props.marketStatus as keyof typeof MARKET_STATUS_LABEL] ?? props.marketStatus}
        </Badge>

        <DataProvenanceBadge provenance={provenance} />

        <div className="ml-auto flex items-center gap-2">
          <span className="num flex items-center gap-1.5 text-[13px] font-semibold">
            <span className="text-[var(--color-muted)]">USD</span>
            {(balanceCents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <DemoBadge />
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── Columna izquierda ─────────────────────────────────────────── */}
        <aside className="hidden w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex">
          <div className="border-b border-[var(--color-border)] p-2.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-subtle)]"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar instrumento"
                aria-label="Buscar instrumento"
                className="h-8 pl-8 text-[12px]"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {catalogMatches.length > 0 && (
              <div className="border-b border-[var(--color-border)] p-1.5">
                <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
                  Otros instrumentos
                </p>
                {catalogMatches.map((c) => (
                  <button
                    key={c.symbol}
                    type="button"
                    onClick={() => selectSymbol(c.symbol)}
                    className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-xs)] px-2 py-1.5 text-left hover:bg-[var(--color-overlay)]"
                  >
                    <span className="num text-[11px]">{c.symbol}</span>
                    {c.minPlan !== 'FREE' && <Badge tone="gold">{c.minPlan}</Badge>}
                  </button>
                ))}
              </div>
            )}

            <ul>
              {filteredWatchlist.map((w) => (
                <li key={w.symbol}>
                  <button
                    type="button"
                    onClick={() => selectSymbol(w.symbol)}
                    aria-current={w.symbol === props.symbol.symbol ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
                      w.symbol === props.symbol.symbol
                        ? 'bg-[var(--color-blue-soft)]'
                        : 'hover:bg-[var(--color-overlay)]',
                    )}
                  >
                    {w.favorite && (
                      <Star className="size-3 shrink-0 fill-[var(--color-gold)] text-[var(--color-gold)]" aria-label="Favorito" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="num block text-[11px] font-medium">{w.symbol}</span>
                      <span className="block truncate text-[9px] text-[var(--color-subtle)]">{w.name}</span>
                    </span>
                    <span className="text-right">
                      <span className="num block text-[11px]">{w.price.toFixed(w.precision)}</span>
                      <Delta value={w.changePercent} size="sm" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-[var(--color-border)] p-2.5">
            <Link href="/calendario" className="text-[11px] text-[var(--color-blue)] hover:underline">
              Calendario económico →
            </Link>
            <p className="mt-2 text-[10px] leading-snug text-[var(--color-subtle)]">
              Sesión: {props.symbol.sessionLabel}
            </p>
          </div>
        </aside>

        {/* ── Área central ──────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Controles del gráfico */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
            <Segmented
              ariaLabel="Temporalidad"
              size="sm"
              options={TIMEFRAMES.map((t) => ({ value: t, label: t }))}
              value={timeframe}
              onChange={(v) => changeTimeframe(v)}
            />
            <Segmented
              ariaLabel="Tipo de gráfico"
              size="sm"
              options={CHART_TYPES.map((c) => ({ value: c.value, label: c.label, title: c.title }))}
              value={chartType}
              onChange={setChartType}
            />

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIndicatorMenu((v) => !v)}
                aria-expanded={showIndicatorMenu}
                className="rounded-[var(--radius-xs)] border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                Indicadores {indicators.length > 0 && `(${indicators.length})`}
              </button>
              {showIndicatorMenu && (
                <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-2 shadow-[var(--shadow-lifted)]">
                  {INDICATORS.map((ind) => {
                    const available = props.availableIndicators.includes(ind.id);
                    const active = indicators.includes(ind.id);
                    return (
                      <button
                        key={ind.id}
                        type="button"
                        disabled={!available}
                        onClick={() =>
                          setIndicators((prev) =>
                            prev.includes(ind.id) ? prev.filter((i) => i !== ind.id) : [...prev, ind.id],
                          )
                        }
                        title={available ? ind.description : `Disponible a partir del plan ${ind.minPlan}`}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-[var(--radius-xs)] px-2 py-1.5 text-left text-[11px]',
                          active ? 'bg-[var(--color-blue-soft)] text-[var(--color-blue)]' : 'hover:bg-[var(--color-overlay)]',
                          !available && 'cursor-not-allowed opacity-45',
                        )}
                      >
                        {ind.label}
                        {!available && <Badge tone="gold">{ind.minPlan}</Badge>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <span className="ml-auto text-[10px] text-[var(--color-subtle)]">
              Riesgo educativo del instrumento: {props.symbol.educationalRisk}/5
            </span>
          </div>

          {/* Gráfico */}
          <div className="min-h-0 flex-1 overflow-hidden px-1 py-1">
            <PriceChart
              candles={candles}
              symbol={props.symbol.symbol}
              assetName={props.symbol.name}
              timeframe={timeframe}
              precision={props.symbol.precision}
              chartType={chartType}
              indicators={indicators}
              markers={props.markers}
              events={props.events}
              levels={levels}
              height={380}
            />
            <ChartAttribution providerLabel={provenance.providerLabel} className="px-3 pb-1" />
          </div>

          {/* Zona inferior */}
          <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
            <Tabs
              ariaLabel="Paneles de la terminal"
              active={bottomTab}
              onChange={setBottomTab}
              tabs={[
                { id: 'open', label: 'Abiertas', count: openPositions.length },
                { id: 'history', label: 'Historial', count: props.closedRecent.length },
                { id: 'journal', label: 'Diario' },
                { id: 'analysis', label: 'Análisis IA' },
                { id: 'notes', label: 'Notas' },
              ]}
            />

            <div className="max-h-52 overflow-y-auto">
              {bottomTab === 'open' && (
                <OpenPositionsTable
                  positions={openPositions}
                  onClose={closePosition}
                  onHover={(p) =>
                    setLevels(
                      p
                        ? [
                            { price: p.entryPrice, label: 'Entrada', tone: 'neutral' },
                            ...(p.stopLoss ? [{ price: p.stopLoss, label: 'Stop loss', tone: 'negative' as const }] : []),
                            ...(p.takeProfit ? [{ price: p.takeProfit, label: 'Take profit', tone: 'positive' as const }] : []),
                          ]
                        : [],
                    )
                  }
                />
              )}
              {bottomTab === 'history' && <HistoryTable items={props.closedRecent} />}
              {bottomTab === 'journal' && (
                <PanelMessage
                  text="Cada simulación cerrada puede documentarse en el diario. Es donde se acumula el aprendizaje real."
                  href="/diario"
                  cta="Abrir el diario"
                />
              )}
              {bottomTab === 'analysis' && (
                <PanelMessage
                  text="Pide al entrenador que revise este gráfico o una simulación cerrada. Nunca te dirá qué comprar: te dirá qué mirar."
                  href={`/entrenador?symbol=${props.symbol.symbol}&tf=${timeframe}`}
                  cta="Pedir un análisis educativo"
                />
              )}
              {bottomTab === 'notes' && (
                <PanelMessage
                  text="Las notas y el registro de estrategias viven en el diario, junto a las simulaciones que las originaron."
                  href="/diario"
                  cta="Ir al diario"
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Panel de simulación (escritorio) ─────────────────────────── */}
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] xl:block">
          <SimulationPanel
            symbol={props.symbol}
            quote={quote}
            timeframe={timeframe}
            indicators={indicators}
            chartType={chartType}
            balanceCents={balanceCents}
            entitlements={props.entitlements}
            portfolios={props.portfolios}
            marketClosed={marketClosed}
            onLevelsChange={setLevels}
            onCreated={(result) => {
              setBalanceCents(result.balanceCents);
              setToast({ tone: 'ok', text: 'Simulación creada. Puedes seguirla en el panel inferior.' });
              router.refresh();
            }}
            onError={(message) => setToast({ tone: 'error', text: message })}
          />
        </aside>
      </div>

      {/* ── Panel de simulación (móvil): hoja inferior ────────────────── */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-blue)] py-3.5 text-[13px] font-semibold text-white xl:hidden"
        style={{ paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom))' }}
      >
        <ChevronUp className="size-4" aria-hidden="true" />
        Crear una simulación
      </button>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end xl:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSheetOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Crear una simulación"
            className="animate-sheet-up relative max-h-[88dvh] w-full overflow-y-auto rounded-t-[var(--radius-xl)] border-t border-[var(--color-border-strong)] bg-[var(--color-elevated)]"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-3">
              <p className="text-[13px] font-semibold">Nueva simulación · {props.symbol.symbol}</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Cerrar"
                className="flex size-8 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-muted)]"
              >
                <X className="size-4" />
              </button>
            </div>
            <SimulationPanel
              symbol={props.symbol}
              quote={quote}
              timeframe={timeframe}
              indicators={indicators}
              chartType={chartType}
              balanceCents={balanceCents}
              entitlements={props.entitlements}
              portfolios={props.portfolios}
              marketClosed={marketClosed}
              onLevelsChange={setLevels}
              onCreated={(result) => {
                setBalanceCents(result.balanceCents);
                setSheetOpen(false);
                setToast({ tone: 'ok', text: 'Simulación creada.' });
                router.refresh();
              }}
              onError={(message) => setToast({ tone: 'error', text: message })}
            />
          </div>
        </div>
      )}

      {/* Aviso emergente */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'animate-fade-up fixed bottom-24 left-1/2 z-60 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2',
            'rounded-[var(--radius-md)] border p-3.5 shadow-[var(--shadow-lifted)] xl:bottom-6',
            toast.tone === 'ok'
              ? 'border-[color-mix(in_srgb,var(--color-positive)_30%,transparent)] bg-[var(--color-elevated)]'
              : 'border-[color-mix(in_srgb,var(--color-negative)_30%,transparent)] bg-[var(--color-elevated)]',
          )}
        >
          <p className="text-[13px] leading-relaxed">{toast.text}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function OpenPositionsTable({
  positions,
  onClose,
  onHover,
}: {
  positions: OpenPositionDto[];
  onClose: (id: string, fraction?: number) => void;
  onHover: (p: OpenPositionDto | null) => void;
}) {
  if (positions.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-[12px] text-[var(--color-muted)]">
        No tienes simulaciones abiertas. Crea una hipótesis desde el panel lateral.
      </p>
    );
  }

  return (
    <table className="w-full text-[11px]">
      <caption className="sr-only">Simulaciones abiertas</caption>
      <thead>
        <tr className="border-b border-[var(--color-border)] text-[var(--color-subtle)]">
          <th scope="col" className="px-3 py-1.5 text-left font-medium">Instrumento</th>
          <th scope="col" className="px-3 py-1.5 text-left font-medium">Dirección</th>
          <th scope="col" className="px-3 py-1.5 text-right font-medium">Entrada</th>
          <th scope="col" className="px-3 py-1.5 text-right font-medium">Actual</th>
          <th scope="col" className="hidden px-3 py-1.5 text-right font-medium sm:table-cell">Stop / TP</th>
          <th scope="col" className="px-3 py-1.5 text-right font-medium">Resultado</th>
          <th scope="col" className="px-3 py-1.5 text-right font-medium">Acción</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => (
          <tr
            key={p.id}
            onMouseEnter={() => onHover(p)}
            onMouseLeave={() => onHover(null)}
            className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-overlay)]"
          >
            <td className="num px-3 py-2 font-medium">{p.symbol}</td>
            <td className="px-3 py-2">
              <Badge tone={p.direction === 'BEARISH' ? 'negative' : 'positive'}>
                {p.direction === 'BEARISH' ? 'Bajista' : 'Alcista'}
              </Badge>
            </td>
            <td className="num px-3 py-2 text-right">{p.entryPrice.toFixed(p.precision)}</td>
            <td className="num px-3 py-2 text-right">{p.currentPrice.toFixed(p.precision)}</td>
            <td className="num hidden px-3 py-2 text-right text-[var(--color-subtle)] sm:table-cell">
              {p.stopLoss ? p.stopLoss.toFixed(p.precision) : '—'} / {p.takeProfit ? p.takeProfit.toFixed(p.precision) : '—'}
            </td>
            <td className="px-3 py-2 text-right">
              <Delta value={p.unrealizedPercent} size="sm" />
            </td>
            <td className="px-3 py-2 text-right">
              <button
                type="button"
                onClick={() => onClose(p.id)}
                className="rounded-[var(--radius-xs)] border border-[var(--color-border-strong)] px-2 py-1 text-[10px] font-medium hover:border-[var(--color-negative)] hover:text-[var(--color-negative)]"
              >
                Cerrar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HistoryTable({ items }: { items: ClosedItem[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-[12px] text-[var(--color-muted)]">
        Todavía no has cerrado ninguna simulación.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {items.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => setExpanded(expanded === s.id ? null : s.id)}
            aria-expanded={expanded === s.id}
            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--color-overlay)]"
          >
            <span className="num text-[11px] font-medium">{s.symbol}</span>
            <Badge tone={s.direction === 'BEARISH' ? 'negative' : 'positive'}>
              {s.direction === 'BEARISH' ? 'Bajista' : 'Alcista'}
            </Badge>
            <span className="num hidden text-[10px] text-[var(--color-subtle)] sm:inline">
              {s.entryPrice.toFixed(s.precision)} → {s.exitPrice?.toFixed(s.precision) ?? '—'}
            </span>
            <span className="ml-auto text-right">
              <span
                className={cn(
                  'num block text-[11px] font-medium',
                  (s.pnlCents ?? 0) > 0
                    ? 'text-[var(--color-positive)]'
                    : (s.pnlCents ?? 0) < 0
                      ? 'text-[var(--color-negative)]'
                      : 'text-[var(--color-muted)]',
                )}
              >
                {(s.pnlCents ?? 0) >= 0 ? '+' : ''}
                {formatVirtualUsd(s.pnlCents ?? 0)}
              </span>
              <span className="text-[9px] text-[var(--color-subtle)]">
                {s.closedAt ? formatRelative(s.closedAt) : ''}
              </span>
            </span>
          </button>

          {expanded === s.id && (
            <div className="space-y-2 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[var(--color-subtle)]">
                  Motivo que escribiste
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-muted)]">{s.rationale}</p>
              </div>
              {s.audit.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-[var(--color-subtle)]">
                    Traza de cálculo del motor
                  </p>
                  <pre className="num mt-1 overflow-x-auto whitespace-pre-wrap text-[9px] leading-relaxed text-[var(--color-subtle)]">
                    {s.audit.join('\n')}
                  </pre>
                </div>
              )}
              <Link
                href={`/diario?simulacion=${s.id}`}
                className="inline-block text-[11px] text-[var(--color-blue)] hover:underline"
              >
                Documentar en el diario →
              </Link>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function PanelMessage({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="px-4 py-6 text-center">
      <p className="mx-auto max-w-md text-[12px] leading-relaxed text-[var(--color-muted)]">{text}</p>
      <Link href={href} className="mt-3 inline-block">
        <Button size="sm" variant="secondary">
          {cta}
        </Button>
      </Link>
    </div>
  );
}
