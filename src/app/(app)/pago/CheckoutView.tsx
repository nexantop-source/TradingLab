'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { Button, Callout } from '@tl/ui';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import type { CheckoutIntent } from '@/lib/checkout-intent';
import { safeWompiCheckoutUrl } from '@/lib/checkout-url';
import { TrialStart } from '@/components/billing/TrialStart';

interface PreparedCheckout {
  status: 'ACTIVE' | 'TRIALING' | 'REDIRECT'; provider?: 'wompi';
  redirectUrl?: string; amountInCents?: number; currency?: string;
  reference?: string; expiresAt?: string; environment?: 'sandbox' | 'production';
}
export function CheckoutView({ intent, plan, existingSubscription, trial }: {
  intent: CheckoutIntent;
  plan: { name: string; tagline: string; referencePriceUsd: number; highlights: string[] };
  existingSubscription: { planId: string; status: string; interval: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean } | null;
  trial: { days: number } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'payment' | 'trial'>('payment');
  const [prepared, setPrepared] = useState<PreparedCheckout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const yearly = intent.interval === 'YEARLY';
  async function prepare() {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true); setError(null);
    const storageKey = `tl-checkout:${intent.plan}:${intent.interval}`;
    try {
      let key = sessionStorage.getItem(storageKey);
      if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(storageKey, key); }
      const result = await apiFetch<PreparedCheckout>('/api/billing/subscribe', { method: 'POST', json: { planId: intent.plan, interval: intent.interval, idempotencyKey: key } });
      if (result.status === 'REDIRECT') {
        if (!result.redirectUrl || result.currency !== 'COP' || !Number.isSafeInteger(result.amountInCents) || result.amountInCents! <= 0) throw new Error('No pudimos validar el importe del pago.');
        safeWompiCheckoutUrl(result.redirectUrl);
      }
      setPrepared(result);
    } catch (e) {
      if (e instanceof ApiRequestError && ['PAYMENT_CHECKOUT_EXPIRED', 'PAYMENT_REFERENCE_USED'].includes(e.code)) sessionStorage.removeItem(storageKey);
      setError(e instanceof Error ? e.message : 'No pudimos preparar el pago. Inténtalo de nuevo.');
    } finally { inFlight.current = false; setLoading(false); }
  }
  function continuePayment() {
    try { if (prepared?.redirectUrl) window.location.assign(safeWompiCheckoutUrl(prepared.redirectUrl)); }
    catch { setError('No pudimos validar el enlace de Wompi. Vuelve a preparar el pago.'); }
  }
  if (existingSubscription) return <div className="checkout-redesign app-content-page"><section className="checkout-surface"><span className="checkout-kicker">TU MEMBRESÍA</span><h1>Ya tienes acceso activo.</h1><p>Tu periodo termina el {new Date(existingSubscription.currentPeriodEnd).toLocaleDateString('es-CO')}. Revisa tu suscripción antes de iniciar otra compra.</p><Link className="invest-button" href="/billing">Ir a Facturación</Link></section></div>;
  return <main className="checkout-redesign app-content-page">
    <Link className="checkout-back" href="/planes"><ArrowLeft size={16}/> Volver a planes</Link>
    <header className="checkout-heading"><span className="checkout-kicker">UN PASO MÁS PARA SEGUIR APRENDIENDO</span><h1>Tu plan, tus condiciones.</h1><p>Revisa lo que recibes y elige cómo empezar.</p></header>
    <div className="checkout-review-grid">
      <aside className="checkout-order checkout-surface" aria-label="Resumen de tu plan">
        <span className="checkout-kicker">RESUMEN</span><h2>TradingLab {plan.name}</h2><p>{plan.tagline}</p>
        <div className="checkout-reference"><strong>USD {plan.referencePriceUsd.toFixed(2)}</strong><span>por {yearly ? 'un año' : 'un mes'} de acceso</span></div>
        <Link href="/planes">Cambiar plan o periodo</Link>
        <details className="checkout-benefit-details"><summary>Ver beneficios incluidos</summary><ul className="checkout-benefits">{plan.highlights.map(item => <li key={item}><Check size={16}/><span>{item}</span></li>)}</ul></details>
        <p className="checkout-education">Herramientas educativas y práctica con saldo virtual. No es una inversión ni un depósito.</p>
      </aside>
      <section className="checkout-surface checkout-decision" aria-label="Modalidad y pago">
        <h2>¿Cómo quieres empezar?</h2>
        <div className="checkout-options" role="group" aria-label="Modalidad de compra">
          <button type="button" className="checkout-option" aria-pressed={mode === 'payment'} disabled={loading} onClick={() => setMode('payment')}><span>Comprar {yearly ? 'un año' : 'un mes'}</span><small>Pago único con Wompi. Sin renovación automática.</small></button>
          {trial && <button type="button" className="checkout-option" aria-pressed={mode === 'trial'} disabled={loading} onClick={() => setMode('trial')}><span>Probar {trial.days} días</span><small>Tarjeta validada y renovación {yearly ? 'anual' : 'mensual'}.</small></button>}
        </div>
        {mode === 'trial' && trial ? <TrialStart key={`${intent.plan}:${intent.interval}`} planId={intent.plan} planName={plan.name} interval={intent.interval} onBusy={setLoading}/> : <div className="checkout-pay" aria-busy={loading}>
          <h3>{prepared?.status === 'REDIRECT' ? 'Este es tu total' : 'Confirma el importe en pesos'}</h3>
          <p>Calculamos el total en COP antes de abrir Wompi. Después eliges allí el medio de pago disponible y autorizas la compra.</p>
          {error && <div role="alert"><Callout tone="danger" title="No pudimos continuar">{error}</Callout></div>}
          {prepared?.status === 'REDIRECT' ? <>
            <div className="checkout-total"><span>Total a pagar ahora</span><strong>COP {(prepared.amountInCents! / 100).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong><small>{yearly ? 'Un año' : 'Un mes'} de acceso · pago único</small></div>
            {prepared.environment === 'sandbox' && <Callout tone="warning" title="Wompi sandbox">Este pago es de prueba; no mueve dinero real.</Callout>}
            <Button fullWidth size="lg" onClick={continuePayment}>Continuar a Wompi <ArrowRight size={16}/></Button>
            <details className="checkout-receipt"><summary>Referencia del pago</summary><p>{prepared.reference}</p>{prepared.expiresAt && <p>Válido hasta {new Date(prepared.expiresAt).toLocaleString('es-CO')}.</p>}</details>
          </> : prepared ? <><Callout tone="success" title="Periodo confirmado">Revisa tu acceso en Facturación.</Callout><Button fullWidth onClick={() => { router.push('/billing'); router.refresh(); }}>Ver mi membresía</Button></> : <Button fullWidth size="lg" loading={loading} onClick={prepare}>Ver total en COP <ArrowRight size={16}/></Button>}
          <p className="checkout-security"><ShieldCheck size={17}/>El plan se activa cuando Wompi aprueba el pago y el servidor verifica el importe y la referencia.</p>
        </div>}
      </section>
    </div>
    <p className="checkout-help">¿Necesitas ayuda? <Link href="/contacto">Contacta con soporte</Link> · <Link href="/legal/terminos">Condiciones del servicio</Link></p>
  </main>;
}
