'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDownRight, ArrowUpRight, ChevronDown, SlidersHorizontal, WalletCards } from 'lucide-react';
import { AssetIcon } from '@/components/investment/AssetIcon';
import { useMarketPulse } from '@/components/trading/useMarketPulse';
import { SimpleLiveChart } from '@/components/trading/SimpleLiveChart';
import { useMotionPreference } from '@/components/pwa/useMotionPreference';
import { useTheme } from '@tl/ui/ThemeProvider';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import type { OpenPositionDto } from '@/lib/simulation-service';
import type { TerminalProps } from './Terminal';
import { SimpleOrderTicket } from './SimpleOrderTicket';

interface PositionsSnapshot { open: OpenPositionDto[]; balanceCents: number; closed: Array<{ id: string; symbol: string; pnlCents: number | null; closeReason: string | null }> }

export function SimpleTerminal(props: TerminalProps & { onAdvanced: () => void }) {
  const router = useRouter();
  const pulse = useMarketPulse(props.symbol.symbol, props.quote, props.provenance);
  const systemReduce = useMotionPreference();
  const { reduceMotion } = useTheme();
  const [range, setRange] = useState<60 | 120>(120);
  const [chartType, setChartType] = useState<'line' | 'area'>('area');
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
  useEffect(() => { setBalance(props.balanceCents); setPositions(props.openPositions); setUsedToday(props.entitlements.simulationsUsedToday); }, [props.balanceCents, props.openPositions, props.entitlements.simulationsUsedToday]);

  const refreshPositions = useCallback(async () => {
    if (!mounted.current || request.current || mutationPending.current || document.hidden || !navigator.onLine) return;
    const generation = snapshotGeneration.current;
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => { if (mounted.current) setPositionsStale(true); controller.abort(); }, 8000);
    try {
      const data = await apiFetch<PositionsSnapshot>('/api/simulations?limit=3', { signal: controller.signal, cache: 'no-store' });
      if (!mounted.current || controller.signal.aborted || generation !== snapshotGeneration.current) return;
      setPositions(data.open); setClosed(data.closed); setBalance(data.balanceCents); setPositionsStale(false);
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
    const id = setInterval(update, 10000);
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
  const chartTicks = useMemo(() => pulse.ticks.slice(-(range + 1)), [pulse.ticks, range]);
  const statusLabel = marketClosed ? 'Sesión cerrada' : pulse.status === 'live' ? 'Simulación · cada segundo' : pulse.status === 'connecting' ? 'Conectando…' : pulse.status === 'offline' ? 'Sin conexión' : pulse.status === 'paused' ? 'En pausa' : 'Datos desactualizados';
  const thisPosition = positions.find(position => position.symbol === props.symbol.symbol);
  const levels = thisPosition ? [
    { price: thisPosition.entryPrice, label: 'Entrada', tone: 'neutral' as const },
    ...(thisPosition.stopLoss !== null ? [{ price: thisPosition.stopLoss, label: 'SL', tone: 'negative' as const }] : []),
    ...(thisPosition.takeProfit !== null ? [{ price: thisPosition.takeProfit, label: 'TP', tone: 'positive' as const }] : []),
  ] : [];
  return <div className="simple-terminal" data-terminal="simple">
    <header className="simple-terminal-top"><Link href="/explorar" className="simple-instrument" aria-label={`Cambiar instrumento: ${props.symbol.name}`}><AssetIcon symbol={props.symbol.symbol} /><span><strong>{props.symbol.symbol}</strong><small>{props.symbol.name}</small></span><ChevronDown size={17} /></Link><button type="button" onClick={props.onAdvanced} className="simple-advanced-button"><SlidersHorizontal size={16} />Avanzado</button></header>
    <div className="simple-terminal-grid"><section className="simple-market-panel" aria-label="Precio y gráfico de práctica">
      <div className="simple-price-heading"><div><span className="simple-demo-pill">MERCADO DEMO</span><p className="simple-live-price" data-testid="simple-live-price">{pulse.quote.price.toLocaleString('en-US', { minimumFractionDigits: props.symbol.precision, maximumFractionDigits: props.symbol.precision })}</p><p className={pulse.quote.changePercent < 0 ? 'simple-negative' : 'simple-positive'}>{pulse.quote.changePercent >= 0 ? '+' : ''}{pulse.quote.changePercent.toFixed(2)} % <span>· variación de referencia 24 h</span></p></div><span className="simple-pulse-state" data-stale={pulse.stale || marketClosed}><i />{statusLabel}</span></div>
      <div className="simple-chart-controls" data-gesture-exclude><div role="group" aria-label="Ventana del gráfico">{([60, 120] as const).map(n => <button key={n} type="button" aria-pressed={range === n} onClick={() => setRange(n)}>{n / 60} min</button>)}</div><div role="group" aria-label="Estilo del gráfico"><button type="button" aria-pressed={chartType === 'line'} onClick={() => setChartType('line')}>Línea</button><button type="button" aria-pressed={chartType === 'area'} onClick={() => setChartType('area')}>Área</button></div></div>
      <SimpleLiveChart ticks={chartTicks} symbol={props.symbol.symbol} precision={props.symbol.precision} stale={pulse.stale || marketClosed} reduceMotion={systemReduce || reduceMotion} chartType={chartType} levels={levels} windowSeconds={range} />
      <p className="simple-market-source">Precios generados para practicar. No son cotizaciones en vivo de una bolsa.</p>
      {pulse.stale && pulse.error && <p className="simple-feed-error" role="status">{pulse.error}</p>}
    </section>
    <div className="simple-trade-panel"><div className="simple-wallet"><WalletCards size={19} aria-hidden="true" /><div><small>Saldo virtual disponible</small><strong>USD {money(balance)}</strong></div><Link href="/perfil" aria-label="Gestionar mi cuenta demo">DEMO<ChevronDown size={13} /></Link></div>
      <SimpleOrderTicket symbol={props.symbol} quote={pulse.quote} balanceCents={balance} stale={pulse.stale} marketClosed={marketClosed} externalBusy={Boolean(closing)} entitlements={{ ...props.entitlements, simulationsUsedToday: usedToday }} onPendingChange={onPendingChange} onReconcile={() => { void refreshPositions(); }} onCreated={result => { setBalance(result.balanceCents); setUsedToday(n => n + 1); setNotice({ text: `Operación demo abierta a ${result.entryPrice.toFixed(props.symbol.precision)}. Puedes seguirla en tus posiciones.` }); router.refresh(); }} />
    </div></div>
    {notice && <p className={notice.error ? 'simple-notice is-error' : 'simple-notice'} role={notice.error ? 'alert' : 'status'}>{notice.text}<button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">×</button></p>}
    <section className="simple-positions" aria-label="Mis ejercicios"><header><div role="group" aria-label="Estado de mis ejercicios"><button type="button" aria-pressed={positionsTab === 'open'} onClick={() => setPositionsTab('open')}>Posiciones <span>{positions.length}</span></button><button type="button" aria-pressed={positionsTab === 'closed'} onClick={() => setPositionsTab('closed')}>Cerradas</button></div><Link href="/portafolio">Ver todas<ArrowUpRight size={15} /></Link></header>
      {positionsStale && <p className="simple-order-status">La revisión de tus posiciones está pendiente de conexión.</p>}
      {positionsTab === 'open' ? positions.length ? <ul>{positions.slice(0, 5).map(p => <li key={p.id}><AssetIcon symbol={p.symbol} size="sm" /><span><strong>{p.symbol} · {p.direction === 'BEARISH' ? 'Bajar' : 'Subir'}</strong><small>Entrada {p.entryPrice.toFixed(p.precision)} · {p.stopLoss ? `SL ${p.stopLoss.toFixed(p.precision)}` : 'Sin SL'}</small></span><span className={p.unrealizedPercent < 0 ? 'simple-negative' : 'simple-positive'}>{p.unrealizedPercent >= 0 ? '+' : ''}{p.unrealizedPercent.toFixed(2)} %</span><button type="button" onClick={() => void closePosition(p.id)} disabled={Boolean(closing) || pulse.stale}>{closing === p.id ? 'Cerrando…' : 'Cerrar'}</button></li>)}</ul> : <div className="simple-empty-positions"><span><ArrowUpRight size={18} /><ArrowDownRight size={18} /></span><div><strong>Una idea, un ejercicio.</strong><p>Elige un monto y una dirección para empezar a observar.</p></div></div> : closed.length ? <ul>{closed.map(p => <li key={p.id}><AssetIcon symbol={p.symbol} size="sm" /><span><strong>{p.symbol}</strong><small>{p.closeReason === 'STOP_LOSS' ? 'Stop loss simulado' : p.closeReason === 'TAKE_PROFIT' ? 'Take profit simulado' : 'Ejercicio cerrado'}</small></span><span className={(p.pnlCents ?? 0) < 0 ? 'simple-negative' : 'simple-positive'}>USD {money(p.pnlCents ?? 0)}</span><Link href="/diario">Diario</Link></li>)}</ul> : <p className="simple-empty-history">Aquí verás tus ejercicios cerrados.</p>}
      <p className="simple-position-disclaimer">El servidor revisa tus simulaciones cada 10 s mientras esta pantalla está abierta. SL/TP se evalúan al revisar; no hay ejecución continua de un broker en segundo plano.</p>
    </section>
  </div>;
}
function money(cents: number) { return (cents / 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
