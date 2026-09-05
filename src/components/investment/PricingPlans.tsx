'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Compass, Layers3, Sparkles, ShieldCheck, BookOpen, ChevronDown } from 'lucide-react';
import { PLAN_ENTITLEMENTS, yearlyDiscountPercent } from '@tl/types/plans';
import { PLANS } from '@tl/types';
import { FluidControl } from './FluidControl';

export function PricingPlans({ heading = true }: { heading?: boolean }) {
  const [interval, setInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  return <section className="invest-section invest-pricing visual-pricing" id="precios">
    {heading && <div className="invest-section-heading centered"><span className="invest-eyebrow">TU RITMO. TU PLAN.</span><h2>Un espacio para cada<br />forma de crecer.</h2><p>Empieza gratis. Amplía tus herramientas cuando las necesites.</p></div>}
    <div className="invest-billing"><FluidControl label="Frecuencia de facturación" value={interval} onChange={setInterval} options={[{ value: 'MONTHLY', label: 'Mensual' }, { value: 'YEARLY', label: 'Anual · ahorra hasta 17%' }]} /></div>
    <div className="invest-plan-grid">{PLANS.map(id => {
      const p = PLAN_ENTITLEMENTS[id];
      const yearly = interval === 'YEARLY';
      const price = yearly ? p.priceYearlyUsd / 12 : p.priceMonthlyUsd;
      const features = [id === 'FREE' ? '20 simulaciones cada día' : 'Simulaciones sin límite fijo', id === 'FREE' ? '5 análisis con IA al día' : `${p.aiAnalysesPerMonth} análisis con IA al mes`, `${p.indicators.length} indicadores técnicos`, `${p.alerts} alertas activas`, `${p.historyDays === 3650 ? '10 años' : p.historyDays === 365 ? '1 año' : '30 días'} de historial`, id === 'FREE' ? 'Academia básica y diario' : id === 'STANDARD' ? 'Academia intermedia y estadísticas' : 'Academia completa y estadísticas', p.adDensity === 'none' ? 'Sin publicidad' : 'Publicidad en espacios identificados'];
      const PlanIcon = id === 'FREE' ? Compass : id === 'STANDARD' ? Layers3 : Sparkles;
      return <article className={`invest-plan plan-${id.toLowerCase()} ${id === 'STANDARD' ? 'featured' : ''}`} key={id}>
        <div className="invest-plan-label"><span>{id === 'FREE' ? 'PARA EMPEZAR' : id === 'STANDARD' ? 'PARA CREAR HÁBITO' : 'PARA PROFUNDIZAR'}</span>{id === 'STANDARD' && <b>Más equilibrio</b>}</div>
        <span className="invest-plan-emblem"><PlanIcon size={26} strokeWidth={1.5} aria-hidden="true" /></span>
        <h3>{p.name}</h3><p className="invest-plan-tagline">{p.tagline}</p>
        <div className="invest-plan-price"><strong>${price.toLocaleString('en-US', { minimumFractionDigits: price ? 2 : 0, maximumFractionDigits: 2 })}</strong><span>USD / mes</span></div>
        <p className="invest-billing-note">{id === 'FREE' ? 'Gratis, sin tarjeta.' : yearly ? `USD ${p.priceYearlyUsd} al año · ahorras ${yearlyDiscountPercent(id)}%` : 'Facturación mensual. Cancela desde tu perfil.'}</p>
        <Link className={`invest-button ${id === 'STANDARD' ? '' : 'secondary'}`} href={id === 'FREE' ? '/crear-cuenta' : `/crear-cuenta?plan=${id}&interval=${interval}`}>{id === 'FREE' ? 'Empezar gratis' : `Elegir ${p.name}`}<ArrowRight size={16} /></Link>
        <ul>{features.map(f => <li key={f}><Check size={16} aria-hidden="true" />{f}</li>)}</ul>
      </article>;
    })}</div>
    <div className="invest-plan-included"><span><ShieldCheck size={18} />USD 10.000 virtuales en todos los planes</span><span><BookOpen size={18} />Aprendizaje y práctica en un solo lugar</span></div>
    <details className="invest-plan-comparison"><summary>Compara los límites, sin letra pequeña <ChevronDown size={18} /></summary>
      <div className="invest-comparison-scroll" role="region" aria-label="Comparación de planes" tabIndex={0}><table><caption>Límites incluidos en cada plan</caption><thead><tr><th scope="col">Herramienta</th>{PLANS.map(id => <th scope="col" key={id}>{PLAN_ENTITLEMENTS[id].name}</th>)}</tr></thead><tbody>
        {[
          { label: 'Simulaciones / día', value: (id: typeof PLANS[number]) => PLAN_ENTITLEMENTS[id].simulationsPerDay ?? 'Sin límite fijo' },
          { label: 'Análisis con IA', value: (id: typeof PLANS[number]) => { const p = PLAN_ENTITLEMENTS[id]; return p.aiAnalysesPerDay !== null ? `${p.aiAnalysesPerDay} / día` : `${p.aiAnalysesPerMonth} / mes`; } },
          { label: 'Indicadores técnicos', value: (id: typeof PLANS[number]) => PLAN_ENTITLEMENTS[id].indicators.length },
          { label: 'Alertas activas', value: (id: typeof PLANS[number]) => PLAN_ENTITLEMENTS[id].alerts },
          { label: 'Días de historial', value: (id: typeof PLANS[number]) => PLAN_ENTITLEMENTS[id].historyDays },
          { label: 'Publicidad', value: (id: typeof PLANS[number]) => PLAN_ENTITLEMENTS[id].adDensity === 'none' ? 'Sin publicidad' : 'Espacios identificados' },
        ].map(row => <tr key={row.label}><th scope="row">{row.label}</th>{PLANS.map(id => <td key={id}>{row.value(id)}</td>)}</tr>)}
      </tbody></table></div>
    </details>
    <div className="invest-team"><div><span className="invest-eyebrow">TRADINGLAB TEAMS · PROPUESTA PARA EQUIPOS</span><h3>El siguiente nivel también puede ser compartido.</h3><p>Academias, comunidades y empresas. Diseñemos una propuesta alrededor de lo que necesitan aprender.</p></div><Link className="invest-button secondary" href="/contacto">Hablemos de tu equipo <ArrowRight size={16} /></Link></div>
    <p className="invest-pricing-footnote">Los planes pagan herramientas y formación. Las operaciones son DEMO. Precios de referencia en USD; el importe final en COP se presenta antes de confirmar el pago. Teams se cotiza y no se contrata automáticamente.</p>
  </section>;
}
