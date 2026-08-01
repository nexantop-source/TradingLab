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
      { label: 'Portafolios DEMO', value: (p) => String(p.portfolios) },
      { label: 'Reinicios de saldo al mes', value: (p) => String(p.balanceResetsPerMonth) },
      { label: 'Alertas activas', value: (p) => String(p.alerts) },
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
      { label: 'Análisis multitemporal', value: (p) => p.features.multiTimeframeAI },
      { label: 'Comparación de estrategias', value: (p) => p.features.strategyComparison },
      {
        label: 'Backtesting',
        value: (p) =>
          p.features.backtesting === 'none' ? false : p.features.backtesting === 'basic' ? 'Básico' : 'Avanzado',
      },
    ],
  },
  {
    group: 'Aprendizaje',
    rows: [
      { label: 'Academia', value: (p) => (p.id === 'FREE' ? 'Básica' : p.id === 'STANDARD' ? 'Intermedia' : 'Completa') },
      {
        label: 'Certificados',
        value: (p) =>
          p.features.certificates === 'none' ? false : p.features.certificates === 'standard' ? 'Estándar' : 'Verificables',
      },
      { label: 'Diario completo', value: (p) => p.features.journalFull },
      { label: 'Estadísticas avanzadas', value: (p) => p.features.advancedStats },
      { label: 'Historial consultable', value: (p) => (p.historyDays >= 3650 ? 'Sin límite práctico' : `${p.historyDays} días`) },
      { label: 'Informes semanales', value: (p) => p.features.weeklyReports },
      { label: 'Torneos privados', value: (p) => p.features.privateTournaments },
    ],
  },
  {
    group: 'Exportación y soporte',
    rows: [
      { label: 'Exportación a CSV', value: (p) => p.features.exportCsv },
      { label: 'Exportación a PDF', value: (p) => p.features.exportPdf },
      {
        label: 'Publicidad',
        value: (p) =>
          p.adDensity === 'none' ? 'Sin publicidad' : p.adDensity === 'reduced' ? 'Reducida' : 'Programática y patrocinada',
      },
      { label: 'Interstitials', value: () => 'Nunca, en ningún plan' },
      { label: 'Soporte prioritario', value: (p) => p.features.prioritySupport },
      { label: 'Acceso anticipado', value: (p) => p.features.earlyAccess },
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-5 pb-4 pt-8 text-center">
        <Badge tone="blue">Precios</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em]">
          Elige cuánto quieres profundizar
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Todos los planes incluyen los USD 10.000 virtuales y la academia. Lo que cambia es cuánto puedes
          practicar, cuánta ayuda del entrenador recibes y qué herramientas de análisis tienes disponibles.
        </p>
      </section>

      <PricingSection />

      {/* ── Tabla comparativa ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-[-0.03em]">Comparación completa</h2>

        <div className="mt-10 overflow-x-auto">
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
                t: 'Aviso antes de renovar',
                d: 'Te escribimos antes de cada renovación, indicando el importe y la fecha exacta del cargo.',
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
                t: 'Prueba de Premium de 7 días',
                d: 'Disponible una sola vez por cuenta y sin promesas de resultados. Puedes cancelarla antes de que termine sin coste.',
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
                t: 'Precios regionales',
                d: 'Estamos preparando precios ajustados por país. Se aplicarán automáticamente según tu país de residencia declarado.',
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
