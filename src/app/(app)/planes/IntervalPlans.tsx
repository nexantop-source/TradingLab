'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Gift } from 'lucide-react';
import { Badge, Button, Segmented } from '@tl/ui';

interface PlanCard {
  id: string;
  name: string;
  tagline: string;
  monthlyUsd: number;
  yearlyUsd: number;
  yearlyDiscount: number;
  highlights: string[];
  isCurrent: boolean;
  isDowngrade: boolean;
  trialAvailable: boolean;
}

/**
 * Tarjetas de plan con conmutador de periodicidad.
 *
 * El precio anual se muestra dividido por doce junto al ahorro real, en lugar
 * del importe completo: comparar 149 con 14,99 no dice nada, y presentar el
 * anual como si costara diez veces más ahuyenta a quien saldría ganando.
 *
 * Ningún botón pide una tarjeta desde aquí. Llevan al checkout, donde se
 * decide *cómo* pagar: elegir plan y entregar una tarjeta son dos decisiones
 * distintas y merecen dos pasos.
 */
export function IntervalPlans({ plans, trialDays }: { plans: PlanCard[]; trialDays: number }) {
  const [interval, setInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const yearly = interval === 'YEARLY';

  return (
    <>
      <div className="mt-6 flex justify-center">
        <Segmented
          value={interval}
          onChange={setInterval}
          ariaLabel="Periodicidad del plan"
          options={[
            { value: 'MONTHLY', label: 'Mensual' },
            { value: 'YEARLY', label: 'Anual' },
          ]}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const free = plan.monthlyUsd === 0;
          const perMonth = yearly ? plan.yearlyUsd / 12 : plan.monthlyUsd;
          const featured = plan.id === 'PREMIUM';

          return (
            <article
              key={plan.id}
              data-featured={featured || undefined}
              className="app-plan-card flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[length:var(--text-md)] font-semibold">{plan.name}</h2>
                {plan.isCurrent ? (
                  <Badge tone="positive">Tu plan</Badge>
                ) : featured ? (
                  <Badge tone="blue">Más completo</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-muted)]">
                {plan.tagline}
              </p>

              <p className="num mt-4 flex items-baseline gap-1 tracking-[var(--tracking-tight)]">
                {free ? (
                  <span className="text-[length:var(--text-xl)] font-semibold">Gratis</span>
                ) : (
                  <>
                    <span className="text-[length:var(--text-2xs)] font-medium text-[var(--color-subtle)]">USD</span>
                    <span className="text-[length:var(--text-xl)] font-semibold tabular-nums">
                      {perMonth.toFixed(2)}
                    </span>
                    <span className="text-[length:var(--text-2xs)] text-[var(--color-muted)]">/mes</span>
                  </>
                )}
              </p>
              {!free && yearly && (
                <p className="mt-1 text-[length:var(--text-2xs)] text-[var(--color-positive)]">
                  Ahorras un {plan.yearlyDiscount} % pagando USD {plan.yearlyUsd.toFixed(2)} al año
                </p>
              )}
              {!free && !yearly && plan.yearlyDiscount > 0 && (
                <p className="mt-1 text-[length:var(--text-2xs)] text-[var(--color-subtle)]">
                  Anual: un {plan.yearlyDiscount} % menos
                </p>
              )}

              <ul className="mt-4 flex-1 space-y-2">
                {plan.highlights.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-muted)]"
                  >
                    <Check size={13} className="mt-0.5 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {plan.isCurrent ? (
                  <Button variant="outline" fullWidth disabled>
                    Es tu plan actual
                  </Button>
                ) : free || plan.isDowngrade ? (
                  <Link href="/billing">
                    <Button variant="ghost" fullWidth>
                      Gestionar desde Facturación
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href={`/pago?plan=${plan.id}&interval=${interval}`}>
                      <Button variant={featured ? 'primary' : 'outline'} fullWidth>
                        {plan.trialAvailable ? `Probar ${trialDays} días gratis` : `Elegir ${plan.name}`}
                      </Button>
                    </Link>
                    {plan.trialAvailable && (
                      <p className="mt-2 flex items-start gap-1.5 text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-subtle)]">
                        <Gift size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                        Sin cobro hoy. Cancelas antes del día {trialDays} y no pagas nada.
                      </p>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
