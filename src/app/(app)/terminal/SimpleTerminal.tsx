'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDownRight, ArrowUpRight, ChevronDown, SlidersHorizontal, WalletCards } from 'lucide-react';
import { AssetIcon } from '@/components/investment/AssetIcon';
import { useMarketPulse } from '@/components/trading/useMarketPulse';
import { TradingChart } from '@/components/trading/TradingChart';
import { HistoryChart } from '@/components/trading/HistoryChart';
import { DEFAULT_HISTORY_RANGE, HISTORY_RANGES, historyRange } from '@/components/trading/historyRanges';
import { InstrumentSwitcher } from '@/components/trading/InstrumentSwitcher';
import { OperationLive } from '@/components/trading/OperationLive';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import type { OpenPositionDto } from '@/lib/simulation-service';
import type { TerminalProps } from './Terminal';
import { SimpleOrderTicket } from './SimpleOrderTicket';

interface PositionsSnapshot { open: OpenPositionDto[]; balanceCents: number; simulationsUsedToday: number; closed: Array<{ id: string; symbol: string; pnlCents: number | null; closeReason: string | null }> }

export function SimpleTerminal(props: TerminalProps & { onAdvanced: () => void }) {
  const router = useRouter();
  const pulse = useMarketPulse(props.symbol.symbol, props.quote, props.provenance);
  // El rango por defecto es un año, no dos minutos. Quien abre un instrumento
  // por primera vez quiere saber de dónde viene, no verlo temblar.
  const [range, setRange] = useState<string>(DEFAULT_HISTORY_RANGE);
  const [periodChange, setPeriodChange] = useState<number | null>(null);
  const [chartType, setChartType] = useState<'line' | 'area' | 'candles'>('candles');
  const [toolsOpen,setToolsOpen] = useState(false);
  const [switcherOpen,setSwitcherOpen] = useState(false);
  const [indicator,setIndicator] = useState<'SMA20'|'EMA12'|null>(null);
  const [balance, setBalance] = useState(props.balanceCents);
  const [positions, setPositions] = useState(props.openPositions);
  const [usedToday, setUsedToday] = useState(props.entitlements.simulationsUsedToday);
  const [closed, setClosed] = useState<PositionsSnapshot['closed']>(props.closedRecent.slice(0, 3));
  const [closing, setClosing] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);
  const [positionsStale, setPositionsStale] = useState(false);
  const [positionsTab, setPositionsTab] = useState<'open' | 'closed'>('open');
  const request = useRef<AbortController | null>(null);
  const snapshotGeneration = useRef(0);
  const mutationPending = useRef(false);
  const closingRef = useRef(false);
  const mounted = useRef(true);
  // RSC props seed this symbol-keyed mount only. A delayed router.refresh()
  // has no snapshot generation and cannot overwrite a newer mutation or poll.

  const refreshPositions = useCallback(async () => {
    if (!mounted.current || request.current || mutationPending.current || document.hidden || !navigator.onLine) return;
    const generation = snapshotGeneration.current;
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => { if (mounted.current) setPositionsStale(true); controller.abort(); }, 8000);
    try {
      const data = await apiFetch<PositionsSnapshot>('/api/simulations?limit=3', { signal: controller.signal, cache: 'no-store' });
      if (!mounted.current || controller.signal.aborted || generation !== snapshotGeneration.current) return;
      setPositions(data.open); setClosed(data.closed); setBalance(data.balanceCents); setUsedToday(data.simulationsUsedToday); setPositionsStale(false);
    } catch { if (!controller.signal.aborted && mounted.current) setPositionsStale(true); }
    finally { clearTimeout(timeout); if (request.current === controller) request.current = null; }
  }, []);
  const onPendingChange = useCallback((pending: boolean) => {
    mutationPending.current = pending;
    snapshotGeneration.current++;
    request.current?.abort(); request.current = null;
    if (!pending) void refreshPositions();
  }, [refreshPositions]);
  useEffect(() => {
    mounted.current = true;
    const update = () => { if (document.hidden || !navigator.onLine) { request.current?.abort(); setPositionsStale(true); } else void refreshPositions(); };
    void refreshPositions();
    const id = setInterval(update, 3000);
    document.addEventListener('visibilitychange', update); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { mounted.current = false; clearInterval(id); request.current?.abort(); request.current = null; document.removeEventListener('visibilitychange', update); window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, [refreshPositions]);

  async function closePosition(id: string) {
    if (closingRef.current || mutationPending.current || pulse.stale) return;
    closingRef.current = true; setClosing(id); setNotice(null); onPendingChange(true);
    try {
      const result = await apiFetch<{ balanceCents: number; pnlCents: number }>('/api/simulations/' + encodeURIComponent(id) + '/close', { method: 'POST', json: { fraction: 1 }, signal: AbortSignal.timeout(20000) });
      if (!mounted.current) return;
      setBalance(result.balanceCents); setPositions(items => items.filter(item => item.id !== id));
      setNotice({ text: `Ejercicio cerrado. Resultado virtual: USD ${money(result.pnlCents)}.` });
      void refreshPositions(); router.refresh();
    } catch (e) {
      if (mounted.current) setNotice({ error: true, text: e instanceof ApiRequestError && e.status < 500 ? e.message : 'No recibimos la confirmación del cierre. Revisa el historial antes de reintentar.' });
      void refreshPositions();
    } finally { closingRef.current = false; onPendingChange(false); if (mounted.current) setClosing(null); }
  }

  const marketClosed = pulse.provenance.marketStatus !== 'OPEN';
  const live = range === 'LIVE';
  // El pulso por segundo solo existe donde la fuente lo entrega de verdad.
  // En una acción la serie en vivo sería una línea plana con el mismo precio
  // repetido sesenta veces, que aparenta un detalle que no tenemos.
  const liveAvailable = props.symbol.assetClass === 'CRYPTO';
  const chartTicks = useMemo(() => pulse.ticks.slice(-121), [pulse.ticks]);
  const onSummary = useCallback((summary: { changePercent: number } | null) => setPeriodChange(summary?.changePercent ?? null), []);
  // Estas tres cosas se calculaban en cada render, y esta pantalla se vuelve a
  // pintar una vez por segundo con el pulso del mercado: eran trescientos
  // objetos nuevos por segundo, con un `find` sobre el catálogo por cada
  // elemento de la lista de seguimiento. Además de gastar, hacía que la hoja de
  // cambio de instrumento se reiniciara continuamente.
  const closeSwitcher = useCallback(() => setSwitcherOpen(false), []);
  const switcherCatalog = useMemo(
    () => props.catalog.map(c => ({ symbol: c.symbol, name: c.name, assetClass: c.assetClass as never, minPlan: c.minPlan as never, ticker: c.ticker, popularity: c.popularity })),
    [props.catalog],
  );
  const switcherWatchlist = useMemo(() => {
    const meta = new Map(props.catalog.map(c => [c.symbol, c]));
    return props.watchlist.map(w => ({
      symbol: w.symbol, name: w.name, assetClass: w.assetClass as never,
      minPlan: (meta.get(w.symbol)?.minPlan ?? 'FREE') as never,
      ticker: meta.get(w.symbol)?.ticker, popularity: meta.get(w.symbol)?.popularity,
      price: w.price, changePercent: w.changePercent, precision: w.precision, favorite: w.favorite,
    }));
  }, [props.catalog, props.watchlist]);
  // El rótulo dice de dónde viene el precio y con qué frecuencia se renueva.
  // "Cada segundo" solo es cierto donde la fuente lo entrega así; en una acción
  // el dato llega cada veinte segundos y a veces con minutos de retraso.
  const statusLabel = marketClosed ? 'Sesión cerrada' : pulse.status === 'live' ? (pulse.provenance.synthetic ? 'Simulación · cada segundo' : pulse.provenance.freshness === 'REALTIME' ? 'Datos reales · en directo' : 'Datos reales · con retraso') : pulse.status === 'connecting' ? 'Conectando…' : pulse.status === 'offline' ? 'Sin conexión' : pulse.status === 'paused' ? 'En pausa' : 'Datos desactualizados';
  const thisPosition = positions.find(position => position.symbol === props.symbol.symbol);
  const levels = thisPosition ? [
    { price: thisPosition.entryPrice, label: 'Entrada', tone: 'neutral' as const },
    ...(thisPosition.stopLoss !== null ? [{ price: thisPosition.stopLoss, label: 'SL', tone: 'negative' as const }] : []),
    ...(thisPosition.takeProfit !== null ? [{ price: thisPosition.takeProfit, label: 'TP', tone: 'positive' as const }] : []),
  ] : [];
  return <div className="simple-terminal" data-terminal="simple" data-has-position={Boolean(thisPosition)}>
    <InstrumentSwitcher open={switcherOpen} onClose={closeSwitcher} current={props.symbol.symbol} plan={props.user.plan} watchlist={switcherWatchlist} catalog={switcherCatalog} />
    <header className="simple-terminal-top"><button type="button" className="simple-instrument" onClick={() => setSwitcherOpen(true)} aria-haspopup="dialog" aria-expanded={switcherOpen} aria-label={`Cambiar instrumento. Ahora: ${props.symbol.name}`}><AssetIcon symbol={props.symbol.symbol} assetClass={props.symbol.assetClass as never} name={props.symbol.name} /><span><strong>{props.symbol.symbol}</strong><small>{props.symbol.name}</small></span><ChevronDown size={17} /></button><button type="button" onClick={()=>setToolsOpen(!toolsOpen)} aria-expanded={toolsOpen} className="simple-advanced-button"><SlidersHorizontal size={16} />Herramientas</button></header>
    {toolsOpen && <section className="chart-tools" aria-label="Herramientas del gráfico"><div><button aria-pressed={chartType==='candles'} onClick={()=>setChartType('candles')}>Velas · 5 s</button><button aria-pressed={indicator==='SMA20'} onClick={()=>setIndicator(indicator==='SMA20'?null:'SMA20')}>Media SMA20</button>{props.availableIndicators.includes('EMA12')?<button aria-pressed={indicator==='EMA12'} onClick={()=>setIndicator(indicator==='EMA12'?null:'EMA12')}>Media EMA12</button>:<Link href="/planes">EMA12 · Mejorar a Plus</Link>}<button onClick={()=>setIndicator(null)}>Quitar indicador</button></div><p>Arrastra para explorar. Pellizca para ampliar. Cada periodo trae su propia serie: cinco minutos dentro de un día, una semana cuando miras todo el historial. Entrada, SL y TP aparecen sobre la gráfica cuando están en el rango visible.</p></section>}
    <div className="simple-terminal-grid"><section className="simple-market-panel" aria-label="Precio y gráfico de práctica">
      <div className="simple-price-heading"><div><span className="simple-demo-pill">MERCADO DEMO</span><p className="simple-live-price" data-testid="simple-live-price">{pulse.quote.price.toLocaleString('en-US', { minimumFractionDigits: props.symbol.precision, maximumFractionDigits: props.symbol.precision })}</p><p className={(live || periodChange === null ? pulse.quote.changePercent : periodChange) < 0 ? 'simple-negative' : 'simple-positive'}>{(() => { const value = live || periodChange === null ? pulse.quote.changePercent : periodChange; return `${value >= 0 ? '+' : ''}${value.toFixed(2)} %`; })()} <span>· {live || periodChange === null ? 'variación de la sesión' : `en ${historyRange(range).title}`}</span></p></div><div className="simple-status-stack"><span className="simple-pulse-state" data-stale={pulse.stale || marketClosed}><i />{statusLabel}</span>{thisPosition && <OperationLive position={thisPosition} price={pulse.quote.price} stale={pulse.stale} serverTime={pulse.provenance.receivedTimestamp}/>}</div></div>
      <div className="simple-chart-controls" data-gesture-exclude><div className="simple-range-group" role="group" aria-label="Periodo del gráfico">{liveAvailable && <button type="button" aria-pressed={live} onClick={() => setRange('LIVE')} title="Observación por segundo">En vivo</button>}{HISTORY_RANGES.map(item => <button key={item.id} type="button" aria-pressed={range === item.id} onClick={() => setRange(item.id)} aria-label={`Ver ${item.title}`}>{item.label}</button>)}</div><div role="group" aria-label="Estilo del gráfico"><button type="button" aria-pressed={chartType === 'candles'} onClick={() => setChartType('candles')}>Velas</button><button type="button" aria-pressed={chartType === 'line'} onClick={() => setChartType('line')}>Línea</button><button type="button" aria-pressed={chartType === 'area'} onClick={() => setChartType('area')}>Área</button></div></div>
      {live ? <TradingChart
        ticks={chartTicks}
        precision={props.symbol.precision}
        stale={pulse.stale || marketClosed}
        synthetic={pulse.provenance.synthetic}
        sourceLabel={pulse.provenance.providerLabel}
        type={chartType}
        indicator={indicator}
        levels={levels}
        windowSeconds={120}
      /> : <HistoryChart
        symbol={props.symbol.symbol}
        precision={props.symbol.precision}
        rangeId={range}
        type={chartType}
        levels={levels}
        onSummary={onSummary}
      />}
      {pulse.stale && pulse.error && <p className="simple-feed-error" role="status">{pulse.error}</p>}
    </section>
    <div className="simple-trade-panel"><div className="simple-wallet"><WalletCards size={19} aria-hidden="true" /><div><small>Saldo virtual disponible</small><strong>USD {money(balance)}</strong></div><Link href="/perfil" aria-label="Gestionar mi cuenta demo">DEMO<ChevronDown size={13} /></Link></div>
      <SimpleOrderTicket symbol={props.symbol} quote={pulse.quote} balanceCents={balance} stale={pulse.stale} marketClosed={marketClosed} externalBusy={Boolean(closing)} entitlements={{ ...props.entitlements, simulationsUsedToday: usedToday }} onPendingChange={onPendingChange} onReconcile={() => { void refreshPositions(); }} onCreated={result => { setBalance(result.balanceCents); setUsedToday(n => n + 1); setNotice({ text: `Operación demo abierta a ${result.entryPrice.toFixed(props.symbol.precision)}. Puedes seguirla en tus posiciones.` }); router.refresh(); }} />
    </div></div>
    {notice && <p className={notice.error ? 'simple-notice is-error' : 'simple-notice'} role={notice.error ? 'alert' : 'status'}>{notice.text}<button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">×</button></p>}
    <section className="simple-positions" aria-label="Mis ejercicios"><header><div role="group" aria-label="Estado de mis ejercicios"><button type="button" aria-pressed={positionsTab === 'open'} onClick={() => setPositionsTab('open')}>Posiciones <span>{positions.length}</span></button><button type="button" aria-pressed={positionsTab === 'closed'} onClick={() => setPositionsTab('closed')}>Cerradas</button></div><Link href="/portafolio">Ver todas<ArrowUpRight size={15} /></Link></header>
      {positionsStale && <p className="simple-order-status">La revisión de tus posiciones está pendiente de conexión.</p>}
      {positionsTab === 'open' ? positions.length ? <ul>{positions.slice(0, 5).map(p => <li key={p.id}><AssetIcon symbol={p.symbol} size="sm" /><span><strong>{p.symbol} · {p.direction === 'BEARISH' ? 'Bajar' : 'Subir'}</strong><small>Entrada {p.entryPrice.toFixed(p.precision)} · {p.stopLoss ? `SL ${p.stopLoss.toFixed(p.precision)}` : 'Sin SL'}</small></span><span className={p.unrealizedPercent < 0 ? 'simple-negative' : 'simple-positive'}>{p.unrealizedPercent >= 0 ? '+' : ''}{p.unrealizedPercent.toFixed(2)} %</span><button type="button" onClick={() => void closePosition(p.id)} disabled={Boolean(closing) || pulse.stale}>{closing === p.id ? 'Cerrando…' : 'Cerrar'}</button></li>)}</ul> : <div className="simple-empty-positions"><span><ArrowUpRight size={18} /><ArrowDownRight size={18} /></span><div><strong>Una idea, un ejercicio.</strong><p>Elige un monto y una dirección para empezar a observar.</p></div></div> : closed.length ? <ul>{closed.map(p => <li key={p.id}><AssetIcon symbol={p.symbol} size="sm" /><span><strong>{p.symbol}</strong><small>{p.closeReason === 'STOP_LOSS' ? 'Stop loss simulado' : p.closeReason === 'TAKE_PROFIT' ? 'Take profit simulado' : 'Ejercicio cerrado'}</small></span><span className={(p.pnlCents ?? 0) < 0 ? 'simple-negative' : 'simple-positive'}>USD {money(p.pnlCents ?? 0)}</span><Link href="/diario">Diario</Link></li>)}</ul> : <p className="simple-empty-history">Aquí verás tus ejercicios cerrados.</p>}
      <p className="simple-position-disclaimer">Saldo virtual. El servidor revisa posiciones cada 3 s con la pantalla activa; al vencer calcula el cierre con el precio del vencimiento, aunque se consulte después. No hay ejecución de broker en segundo plano.</p>
    </section>
  </div>;
}
function money(cents: number) { return (cents / 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
