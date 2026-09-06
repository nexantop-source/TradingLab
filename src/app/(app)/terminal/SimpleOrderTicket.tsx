'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, ChevronDown, Minus, Plus, SlidersHorizontal, X } from 'lucide-react';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import { estimateSimpleOrder, parseDemoAmount, type SimpleDirection, type SimpleOrderEstimate } from '@/lib/simple-order';
import type { TerminalSymbol, TerminalProps } from './Terminal';

export function SimpleOrderTicket({ symbol, quote, balanceCents, stale, marketClosed, externalBusy, entitlements, onCreated, onReconcile, onPendingChange }: {
  symbol: TerminalSymbol; quote: { bid: number; ask: number }; balanceCents: number; stale: boolean; marketClosed: boolean;
  entitlements: TerminalProps['entitlements']; onCreated: (result: { balanceCents: number; simulationId: string; entryPrice: number }) => void;
  onReconcile: () => void;
  onPendingChange: (pending: boolean) => void;
  externalBusy: boolean;
}) {
  const [amount, setAmount] = useState('50');
  const [duration, setDuration] = useState(0);
  const [stopPercent, setStopPercent] = useState('');
  const [profitPercent, setProfitPercent] = useState('');
  const [review, setReview] = useState<SimpleOrderEstimate | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confidence, setConfidence] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [risk, setRisk] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const isOpen = review !== null;
  const limited = entitlements.simulationsPerDay !== null && entitlements.simulationsUsedToday >= entitlements.simulationsPerDay;
  const modeAvailable = entitlements.modes.includes('POSITION');
  const disabled = stale || marketClosed || limited || !modeAvailable || busy || externalBusy;

  useEffect(() => {
    if (!isOpen) return;
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal(); heading.current?.focus({ preventScroll: true });
    return () => { element?.close(); document.body.style.overflow = overflow; previousFocus?.focus({ preventScroll: true }); };
  }, [isOpen]);

  function choose(direction: SimpleDirection) {
    if (disabled) return;
    setError(null); setUncertain(false); setAcknowledged(false);
    try { setReview(estimateSimpleOrder({ direction, amount, balanceCents, quote, precision: symbol.precision, spreadBps: symbol.spreadBps, stopPercent, profitPercent })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Revisa el monto y los niveles.'); }
  }
  function closeReview() { if (!submitting.current) { setReview(null); setAcknowledged(false); setError(null); } }
  async function confirm() {
    if (!review || submitting.current || disabled || uncertain) return;
    if (!acknowledged) { setError('Confirma que entiendes que el ejercicio usa dinero virtual.'); return; }
    if (review.stakeCents + review.feeCents > balanceCents) { setError('Tu saldo cambió. Vuelve y revisa el monto.'); return; }
    submitting.current = true; setBusy(true); setError(null); onPendingChange(true);
    try {
      const result = await apiFetch<{ balanceCents: number; simulationId: string; entryPrice: number }>('/api/simulations', {
        method: 'POST', signal: AbortSignal.timeout(20000), json: {
          mode: 'POSITION', symbol: symbol.symbol, direction: review.direction, stakeCents: review.stakeCents, durationMinutes: duration || null,
          orderType: 'MARKET', limitPrice: null, leverage: 1, stopLoss: review.stopLoss, takeProfit: review.takeProfit,
          trailingStopDistance: null, confidence, perceivedRisk: risk,
          timeframe: '1m', visibleIndicators: [], chartType: 'line', acknowledgedSimulation: true,
        },
      });
      setReview(null); setAcknowledged(false); onCreated(result);
    } catch (e) {
      const ambiguous = !(e instanceof ApiRequestError) || e.status >= 500 || e.code === 'INVALID_RESPONSE';
      setUncertain(ambiguous);
      setError(ambiguous ? 'No recibimos una confirmación. Revisa tus posiciones antes de intentar otra operación; la solicitud podría haberse procesado.' : e.message);
      onReconcile();
    } finally { submitting.current = false; setBusy(false); onPendingChange(false); }
  }
  const dollars = (cents: number) => (cents / 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return <section className="simple-order-ticket" aria-label="Nueva operación demo" data-gesture-exclude>
    <label className="operation-duration">Tiempo de operación<select aria-label="Tiempo de operación" value={duration} disabled={isOpen || busy} onChange={e=>setDuration(Number(e.target.value))}><option value={0}>Sin vencimiento</option>{[1,2,5,15,60].map(n=><option key={n} value={n}>{n} min</option>)}</select></label>
    <div className="simple-order-label"><label htmlFor="simple-amount">Monto de la operación</label><span>USD · DEMO</span></div>
    <div className="simple-amount-control"><button type="button" aria-label="Reducir monto en 10 USD" onClick={() => setAmount(String(Math.max(1, (parseDemoAmount(amount) ?? 100) / 100 - 10)))}><Minus size={19} /></button><input id="simple-amount" inputMode="decimal" type="text" autoComplete="off" maxLength={12} value={amount} onChange={e => { setAmount(e.target.value); setError(null); }} aria-describedby="simple-amount-note" /><button type="button" aria-label="Aumentar monto en 10 USD" onClick={() => setAmount(String(Math.min(100000, (parseDemoAmount(amount) ?? 0) / 100 + 10)))}><Plus size={19} /></button></div>
    <div className="simple-amount-shortcuts">{[10, 50, 100, 250].map(n => <button type="button" key={n} onClick={() => { setAmount(String(n)); setError(null); }} aria-pressed={parseDemoAmount(amount) === n * 100}>${n}</button>)}</div>
    <details className="simple-risk-controls"><summary><SlidersHorizontal size={17} /><span>Stop loss y take profit<small>{stopPercent || profitPercent ? 'Niveles personalizados' : 'Opcionales · Sin apalancamiento'}</small></span><ChevronDown size={17} /></summary><div className="simple-risk-fields"><label>Stop loss <span>% del precio</span><input type="text" inputMode="decimal" placeholder="Sin definir" value={stopPercent} onChange={e => setStopPercent(e.target.value)} aria-label="Distancia de stop loss en porcentaje" /></label><label>Take profit <span>% del precio</span><input type="text" inputMode="decimal" placeholder="Sin definir" value={profitPercent} onChange={e => setProfitPercent(e.target.value)} aria-label="Distancia de take profit en porcentaje" /></label></div><p>Distancia respecto a la entrada estimada. Ajustamos el lado según elijas Subir o Bajar; verás los precios antes de confirmar. De 0,01 % a 95 %.</p></details>
    {!isOpen && error && <p className="simple-order-error" role="alert">{error}</p>}
    {limited && <div className="upgrade-hint"><span>Explore incluye {entitlements.simulationsPerDay} ejercicios por día. Tus posiciones abiertas siguen disponibles.</span><Link href="/precios">Ver Plus</Link></div>}
    <div className="simple-direction-actions"><button type="button" className="simple-up" onClick={() => choose('BULLISH')} disabled={disabled}><ArrowUpRight size={23} /><span>Subir<small>Posición alcista</small></span></button><button type="button" className="simple-down" onClick={() => choose('BEARISH')} disabled={disabled}><ArrowDownRight size={23} /><span>Bajar<small>Posición bajista</small></span></button></div>
    <p id="simple-amount-note" className="simple-order-footnote">Sin dinero real. Siempre revisarás el ejercicio antes de abrirlo.</p>
    {disabled && <p className="simple-order-status" role="status">{busy || externalBusy ? 'Actualizando tus ejercicios…' : marketClosed ? 'Mercado de referencia cerrado. Consulta su horario o explora otro instrumento.' : stale ? 'Esperando una cotización actualizada. No se pueden abrir operaciones sin conexión.' : limited ? `Alcanzaste las ${entitlements.simulationsPerDay} simulaciones diarias de ${entitlements.planName}.` : 'Este modo no está disponible en tu plan.'}</p>}
    {balanceCents < 100 && <Link href="/perfil" className="simple-inline-link">Gestionar saldo virtual en mi cuenta</Link>}
    <dialog ref={dialog} className="simple-review" aria-labelledby="simple-review-title" onCancel={e => { e.preventDefault(); closeReview(); }} data-gesture-exclude>
      {review && <><header><span className="simple-demo-pill">EJERCICIO DEMO · 1×</span><button type="button" disabled={busy} onClick={closeReview} aria-label="Cerrar revisión"><X size={21} /></button></header><h2 id="simple-review-title" tabIndex={-1} ref={heading}>{review.direction === 'BULLISH' ? 'Subir' : 'Bajar'} · {symbol.symbol}</h2><p className="simple-review-subtitle">Revisa tu idea, no solo la dirección.</p>
      <dl className="simple-review-summary"><div><dt>Monto virtual</dt><dd>USD {dollars(review.stakeCents)}</dd></div><div><dt>Entrada estimada</dt><dd>{review.entryPrice.toFixed(symbol.precision)}</dd></div><div><dt>Stop loss</dt><dd>{review.stopLoss?.toFixed(symbol.precision) ?? 'Sin definir'}</dd></div><div><dt>Take profit</dt><dd>{review.takeProfit?.toFixed(symbol.precision) ?? 'Sin definir'}</dd></div><div><dt>Comisión virtual estimada</dt><dd>USD {dollars(review.feeCents)}</dd></div></dl>
      <p className="simple-review-warning">Duración: {duration ? `${duration} minutos desde la confirmación` : 'sin vencimiento'}. {review.stopLoss === null ? 'Sin stop loss podrías perder todo el monto virtual comprometido. ' : ''}El servidor determina la entrada al confirmar y evalúa SL/TP al revisar las simulaciones. No son órdenes de un broker ni protección de dinero real.</p>
      <details className="simple-reflection"><summary>Confianza y riesgo percibido<ChevronDown size={16} /></summary><div><label>Confianza<select value={confidence} onChange={e => setConfidence(e.target.value as typeof confidence)}><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option></select></label><label>Riesgo percibido<select value={risk} onChange={e => setRisk(Number(e.target.value))}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} de 5</option>)}</select></label></div></details>
      <label className="simple-review-ack"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /><span>Entiendo que es una simulación con dinero virtual. No se ejecutan órdenes en mercados reales.</span></label>
      {error && <p className="simple-order-error" role="alert">{error}</p>}
      {stale && <p className="simple-order-status" role="status">La cotización está desactualizada. Espera conexión antes de confirmar.</p>}
      <button type="button" className={`simple-confirm ${review.direction === 'BULLISH' ? 'simple-up' : 'simple-down'}`} disabled={disabled || !acknowledged || uncertain} onClick={confirm}>{busy ? 'Abriendo ejercicio…' : 'Confirmar operación demo'}</button>
      <button type="button" className="simple-review-back" disabled={busy} onClick={closeReview}>{uncertain ? 'Volver y revisar mis posiciones' : 'Volver sin abrir'}</button></>}
    </dialog>
  </section>;
}
