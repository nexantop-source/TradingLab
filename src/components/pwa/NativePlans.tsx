'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Compass, Layers3, Sparkles, ShieldCheck } from 'lucide-react';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
import { type PlanId } from '@tl/types';
import { FluidControl } from '@/components/investment/FluidControl';

export function NativePlans({ currentPlan }: { currentPlan: PlanId | null }) {
  const [selected, setSelected] = useState<'STANDARD' | 'PREMIUM'>(currentPlan === 'PREMIUM' ? 'PREMIUM' : 'STANDARD');
  const [interval, setInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const plan = PLAN_ENTITLEMENTS[selected];
  const current = currentPlan === selected;
  const destination = current ? '/perfil' : `${currentPlan ? '/pago' : '/crear-cuenta'}?plan=${selected}&interval=${interval}`;
  return <section className="native-plans" aria-labelledby="app-plans-title">
    <header className="native-page-intro"><span className="native-kicker">HECHO PARA TU RITMO</span><h1 id="app-plans-title">Más espacio<br />para aprender.</h1><p>Tu espacio gratuito ya está incluido. Amplía tus herramientas solo si lo necesitas.</p></header>
    <div className="native-free-status"><Compass size={22} aria-hidden="true" /><div><strong>{currentPlan === 'FREE' ? 'Explore está activo' : 'Explore siempre incluido'}</strong><p>{currentPlan && currentPlan !== 'FREE' ? 'Si tu acceso de pago vence, continúas gratis automáticamente.' : 'Sin tarjeta ni activación. Es tu acceso base cuando no tienes un plan de pago.'}</p></div><Check size={17} aria-hidden="true" /></div>
    <FluidControl label="Periodo de acceso" value={interval} onChange={setInterval} options={[{ value: 'MONTHLY', label: '1 mes' }, { value: 'YEARLY', label: '1 año' }]} />
    <fieldset className="native-plan-options"><legend className="sr-only">Amplía tu espacio con un plan de pago</legend>{(['STANDARD', 'PREMIUM'] as const).map(id => {
      const item = PLAN_ENTITLEMENTS[id];
      const Icon = id === 'STANDARD' ? Layers3 : Sparkles;
      const price = interval === 'YEARLY' ? item.priceYearlyUsd : item.priceMonthlyUsd;
      return <label key={id} className="native-plan-option" data-selected={selected === id}>
        <input type="radio" name="app-plan" value={id} checked={selected === id} onChange={() => setSelected(id)} />
        <span className="native-plan-symbol"><Icon size={22} aria-hidden="true" /></span>
        <span className="native-plan-name"><strong>{item.name}{currentPlan === id && <small>Actual</small>}</strong><span>{id === 'STANDARD' ? 'Construye tu hábito' : 'Profundiza tu análisis'}</span></span>
        <span className="native-plan-cost"><strong>${price.toFixed(2)}</strong><span>USD / {interval === 'YEARLY' ? 'año' : 'mes'}</span></span>
        <span className="native-plan-check" aria-hidden="true">{selected === id && <Check size={13} />}</span>
      </label>;
    })}</fieldset>
    <section className="native-plan-benefits" aria-live="polite" aria-atomic="true"><h2>Tu espacio {plan.name} incluye</h2><ul>{plan.highlights.slice(0, 5).map(feature => <li key={feature}><Check size={16} aria-hidden="true" />{feature}</li>)}</ul></section>
    <div className="native-plan-currency"><ShieldCheck size={19} aria-hidden="true" /><p>TradingLab es de Colombia. Precios en USD; verás el total en COP con la TRM vigente antes de pagar.</p></div>
    <div className="native-plan-action"><Link href={destination} className="native-primary-button">{current ? 'Ver mi suscripción' : `Continuar con ${plan.name}`}<ChevronRight size={19} aria-hidden="true" /></Link><p>Compras {interval === 'YEARLY' ? 'un año' : 'un mes'} de acceso. Sin renovación automática.</p></div>
    <Link className="native-quiet-link" href={currentPlan ? '/app' : '/crear-cuenta'}>Ahora no, continuar en mi espacio</Link>
    <p className="native-plan-education">Herramientas educativas y simulación. No es un depósito ni una inversión.</p>
  </section>;
}
