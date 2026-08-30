import * as React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { PricingSection, FAQSection } from '@/components/marketing/sections';
import { Badge, Button, Card } from '@tl/ui';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
import { PLANS } from '@tl/types';
import { DISCLAIMERS } from '@tl/types/compliance';

export const metadata: Metadata = {
  title: 'Planes y precios',
  description:
    'Compara los planes Free, Standard y Premium de TradingLab. Precios transparentes, cancelación en dos clics y sin cargos ocultos.',
};

/** Filas de la tabla comparativa. `value` devuelve el texto por plan. */
const COMPARISON: Array<{
  group: string;
  rows: Array<{ label: string; value: (p: (typeof PLAN_ENTITLEMENTS)['FREE']) => string | boolean }>;
}> = [
  {
    group: 'Simulación',
    rows: [
      { label: 'Saldo virtual inicial', value: () => 'USD 10.000' },
      {
        label: 'Simulaciones al día',
        value: (p) => (p.simulationsPerDay == null ? 'Sin límite fijo' : String(p.simulationsPerDay)),
      },
      { label: 'Hipótesis direccional', value: () => true },
      { label: 'Posiciones con stop loss y take profit', value: (p) => p.simulationModes.includes('POSITION') },
    ],
  },
  {
    group: 'Datos y análisis',
    rows: [
      {
        label: 'Latencia del dato',
        value: (p) => (p.maxDataDelaySeconds === 0 ? 'Tiempo real si el proveedor lo permite' : 'Hasta 15 minutos'),
      },
      { label: 'Indicadores técnicos', value: (p) => `${p.indicators.length} disponibles` },
      {
        label: 'Análisis educativos con IA',
        value: (p) =>
          p.aiAnalysesPerDay != null ? `${p.aiAnalysesPerDay} al día` : `${p.aiAnalysesPerMonth} al mes`,
      },
    ],
  },
  {
    group: 'Aprendizaje',
    rows: [
      { label: 'Academia', value: (p) => (p.id === 'FREE' ? 'Básica' : p.id === 'STANDARD' ? 'Intermedia' : 'Completa') },
      { label: 'Diario educativo', value: (p) => p.features.journalFull },
      { label: 'Estadísticas avanzadas', value: (p) => p.features.advancedStats },
      { label: 'Historial consultable', value: (p) => (p.historyDays >= 3650 ? 'Sin límite práctico' : `${p.historyDays} días`) },
    ],
  },
  {
    group: 'Experiencia',
    rows: [
      {
        label: 'Publicidad',
        value: (p) =>
          p.adDensity === 'none' ? 'Sin publicidad' : p.adDensity === 'reduced' ? 'Reducida' : 'Programática y patrocinada',
      },
      { label: 'Interstitials', value: () => 'Nunca, en ningún plan' },
      { label: 'Reinicios de saldo al mes', value: (p) => String(p.balanceResetsPerMonth) },
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="public-hero">
        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-12 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <Badge tone="blue">Planes claros · sin permanencia</Badge>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl">
              Paga por profundidad, <span className="text-[var(--color-blue)]">no por promesas.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--color-muted)]">
              Todos empiezan con USD 10.000 virtuales y una ruta educativa. Elige más práctica, más contexto y menos publicidad cuando tu proceso lo necesite.
            </p>
          </div>
          <dl className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-3 lg:grid-cols-1">
            {[
              ['DEMO', 'Nunca manejamos tu capital de inversión'],
              ['COP', 'Wompi muestra el cobro final antes de pagar'],
              ['2 clics', 'Cancelación desde tu perfil'],
            ].map(([term, description]) => (
              <div key={term} className="bg-[var(--color-surface)] p-4">
                <dt className="num text-[11px] font-semibold text-[var(--color-blue)]">{term}</dt>
                <dd className="mt-1 text-[12px] leading-snug text-[var(--color-muted)]">{description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <PricingSection showHeading={false} />

      {/* ── Tabla comparativa ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-[-0.03em]">Comparación completa</h2>

        <div className="pricing-comparison mt-10 overflow-x-auto">
          <table className="w-full min-w-[42rem] text-[13px]">
            <caption className="sr-only">Comparación de funciones entre los planes Free, Standard y Premium</caption>
            <thead>
              <tr className="border-b border-[var(--color-border-strong)]">
                <th scope="col" className="px-3 py-3 text-left font-medium text-[var(--color-muted)]">
                  Función
                </th>
                {PLANS.map((id) => (
                  <th key={id} scope="col" className="px-3 py-3 text-center">
                    <span className="block text-[14px] font-semibold">{PLAN_ENTITLEMENTS[id].name}</span>
                    <span className="num mt-0.5 block text-[11px] font-normal text-[var(--color-muted)]">
                      {PLAN_ENTITLEMENTS[id].priceMonthlyUsd === 0
                        ? 'Gratis'
                        : `USD ${PLAN_ENTITLEMENTS[id].priceMonthlyUsd.toFixed(2)}/mes`}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((group) => (
                <React.Fragment key={group.group}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={4}
                      className="px-3 pb-2 pt-6 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-blue)]"
                    >
                      {group.group}
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label} className="border-b border-[var(--color-border)]">
                      <th scope="row" className="px-3 py-2.5 text-left font-normal text-[var(--color-muted)]">
                        {row.label}
                      </th>
                      {PLANS.map((id) => {
                        const value = row.value(PLAN_ENTITLEMENTS[id]);
                        return (
                          <td key={id} className="px-3 py-2.5 text-center">
                            {typeof value === 'boolean' ? (
                              value ? (
                                <Check className="mx-auto size-4 text-[var(--color-positive)]" aria-label="Incluido" />
                              ) : (
                                <Minus className="mx-auto size-4 text-[var(--color-subtle)]" aria-label="No incluido" />
                              )
                            ) : (
                              <span className="num text-[12px]">{value}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Reglas comerciales ───────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Nuestras reglas comerciales</h2>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
            Las escribimos aquí para que puedas exigirnos su cumplimiento.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              {
                t: 'Cancelación en dos clics',
                d: 'Desde tu perfil, sin encuestas obligatorias, sin ofertas que bloqueen el flujo y sin necesidad de escribir a soporte.',
              },
              {
                t: 'Sin cobro automático',
                d: 'Cada pago cubre un periodo. Antes de que venza te mostramos la fecha y tú decides si compras el siguiente.',
              },
              {
                t: 'Sin cargos ocultos',
                d: 'El precio que ves es el que pagas. No hay comisiones de activación, de mantenimiento ni de cancelación.',
              },
              {
                t: 'Sin patrones oscuros',
                d: 'No usamos cuentas atrás falsas, escasez inventada ni casillas premarcadas para contratar servicios adicionales.',
              },
              {
                t: 'Free sigue disponible',
                d: 'No necesitas pagar para conservar tu cuenta DEMO, el diario o el acceso educativo básico.',
              },
              {
                t: 'Descuento anual visible',
                d: 'El ahorro del plan anual se muestra siempre en porcentaje junto al precio, no en letra pequeña.',
              },
              {
                t: 'Becas educativas',
                d: 'Disponemos de un programa de acceso gratuito al plan Standard para estudiantes y entidades educativas. Escríbenos desde el centro de ayuda.',
              },
              {
                t: 'Importe final visible',
                d: 'El servidor firma el precio en COP y lo muestra antes de enviarte a Wompi; el navegador no puede modificarlo.',
              },
            ].map((r) => (
              <Card key={r.t} className="p-5">
                <p className="text-[14px] font-semibold">{r.t}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-muted)]">{r.d}</p>
              </Card>
            ))}
          </div>

          <div className="mt-8 rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--color-gold)_24%,transparent)] bg-[var(--color-gold-soft)] p-5">
            <p className="text-[13px] leading-relaxed text-[var(--color-muted)]">
              <span className="font-semibold text-[var(--color-gold)]">Importante. </span>
              {DISCLAIMERS.billing}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/crear-cuenta">
              <Button size="lg">Crear mi cuenta DEMO gratis</Button>
            </Link>
            <Link href="/legal/terminos">
              <Button size="lg" variant="outline">
                Leer los términos
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <FAQSection />
    </>
  );
}
