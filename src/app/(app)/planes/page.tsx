import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';
import { getAuth } from '@/lib/auth';
import { PLAN_ENTITLEMENTS, PLAN_ORDER, yearlyDiscountPercent } from '@tl/types/plans';
import { PLANS, type PlanId } from '@tl/types';
import { Badge } from '@tl/ui';
import { trialEligibility, trialPaymentsConfigured, TRIAL_DAYS, TRIAL_PLANS } from '@/lib/trials';
import { IntervalPlans } from './IntervalPlans';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Planes' };

/**
 * Planes dentro de la aplicación.
 *
 * Antes, subir de plan echaba a la persona a la landing pública: se perdía la
 * barra lateral, el saldo y el contexto de lo que estaba haciendo, y volver
 * costaba. Aquí la decisión ocurre sin salir del producto.
 *
 * La elegibilidad para la prueba se resuelve en el servidor y se anuncia, pero
 * el formulario de tarjeta **no** aparece aquí: elegir plan y entregar una
 * tarjeta son dos decisiones distintas y merecen dos pasos distintos.
 */
export default async function AppPlansPage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const eligibility = await trialEligibility(auth.user.id);
  const current = auth.user.plan;

  const plans = PLANS.map((id) => {
    const plan = PLAN_ENTITLEMENTS[id];
    return {
      id,
      name: plan.name,
      tagline: plan.tagline,
      monthlyUsd: plan.priceMonthlyUsd,
      yearlyUsd: plan.priceYearlyUsd,
      yearlyDiscount: yearlyDiscountPercent(id),
      highlights: plan.highlights.slice(0, 7),
      isCurrent: id === current,
      isDowngrade: PLAN_ORDER[id] < PLAN_ORDER[current],
      trialAvailable: trialPaymentsConfigured() && eligibility.eligible && TRIAL_PLANS.includes(id as (typeof TRIAL_PLANS)[number]),
    };
  });

  return (
    <div className="app-content-page mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header>
        <p className="app-page-kicker">Tu plan</p>
        <h1 className="mt-2 text-[length:var(--text-2xl)] font-semibold tracking-[var(--tracking-display)]">
          Elige cómo quieres aprender.
        </h1>
        <p className="mt-2.5 max-w-2xl text-[length:var(--text-xs)] leading-relaxed text-[var(--color-muted)]">
          Ahora mismo tienes <strong className="text-[var(--color-text)]">{PLAN_ENTITLEMENTS[current].name}</strong>.
          {trialPaymentsConfigured() && eligibility.eligible
            ? ` Compara los límites y elige pago único o ${TRIAL_DAYS} días de prueba con tarjeta validada.`
            : ' Los cambios de plan se aplican al confirmar el pago.'}
        </p>
      </header>

      <IntervalPlans plans={plans} trialDays={TRIAL_DAYS} />

      <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
        <h2 className="flex items-center gap-2 text-[length:var(--text-sm)] font-semibold">
          <Sparkles size={15} className="text-[var(--color-blue)]" aria-hidden="true" />
          Lo que incluye cualquier plan
        </h2>
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {[
            'Práctica exclusivamente con dinero virtual, nunca con dinero real',
            'Academia según tu plan, con seguimiento de progreso',
            'Diario educativo con el historial incluido en tu plan',
            'Procedencia del dato visible en cada gráfico, con su latencia',
          ].map((item) => (
            <li
              key={item}
              className="flex gap-2 text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-muted)]"
            >
              <Check size={13} className="mt-0.5 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-subtle)]">
        Los precios se muestran en dólares y el cobro se realiza en pesos colombianos.{' '}
        <Link href="/legal/terminos" className="text-[var(--color-blue)]">
          Consulta los términos
        </Link>{' '}
        o{' '}
        <Link href="/billing" className="text-[var(--color-blue)]">
          revisa tu facturación
        </Link>
        .
      </p>

      {!eligibility.eligible && eligibility.reason === 'TRIAL_ALREADY_USED' && (
        <p className="mt-3 flex items-center gap-2 text-[length:var(--text-2xs)] text-[var(--color-subtle)]">
          <Badge tone="neutral">Prueba ya utilizada</Badge>
          Esta cuenta ya disfrutó su prueba gratuita, así que el cambio de plan se cobra desde el primer periodo.
        </p>
      )}
    </div>
  );
}
