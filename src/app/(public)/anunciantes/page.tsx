import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { AD_SLOTS, SPONSOR_PACKAGES, FORBIDDEN_SURFACES } from '@tl/ads';
import { Badge, Button, Card } from '@tl/ui';

export const metadata: Metadata = {
  title: 'Anunciantes y patrocinios',
  description:
    'Inventario publicitario, paquetes de patrocinio y normas editoriales de TradingLab para anunciantes.',
};

const FORBIDDEN_LABELS: Record<string, string> = {
  'terminal-chart': 'Sobre el gráfico de la terminal',
  'terminal-order-form': 'Dentro del formulario de una operación',
  'simulation-confirmation': 'Durante la confirmación de una simulación',
  'risk-alert': 'Dentro de alertas de riesgo',
  'stop-loss-editor': 'Mientras el usuario define un stop loss',
  quiz: 'Dentro de cuestionarios y evaluaciones',
  'ai-analysis': 'Junto a los análisis del entrenador educativo',
  checkout: 'En el proceso de pago',
};

const LIVE_AD_SLOT_CODES = new Set([
  'dashboard-banner',
  'dashboard-side',
  'academy-footer',
  'lesson-sponsor',
  'calendar-sponsor',
  'news-native',
  'challenge-sponsor',
]);

export default function AdvertisersPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <header className="max-w-2xl">
        <Badge tone="blue">Inventario piloto</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">
          Publicidad que no interfiere con el aprendizaje
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-muted)]">
          Hemos diseñado espacios publicitarios para sostener el plan gratuito sin interferir con el aprendizaje.
          La entrega facturable todavía no está habilitada: primero activaremos AdSense, validaremos tráfico real y
          completaremos la medición persistente. Cuando abra el piloto, todo espacio se etiquetará y los anunciantes
          financieros pasarán revisión manual de cumplimiento.
        </p>
      </header>

      {/* Paquetes */}
      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight">Paquetes de patrocinio</h2>
        <p className="mt-2 text-[13px] text-[var(--color-muted)]">
          Referencias de planificación para un futuro piloto; no constituyen una oferta activa. La propuesta final
          se calculará solo con inventario histórico verificado, sin garantizar volumen antes de medir tráfico,
          país, audiencia y demanda.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {SPONSOR_PACKAGES.map((p) => (
            <Card key={p.code} className="flex flex-col p-6">
              <h3 className="text-[16px] font-semibold">{p.name}</h3>
              <p className="num mt-2 text-2xl font-semibold tracking-tight">
                desde USD {p.monthlyPriceUsdFrom}
                <span className="text-[13px] font-normal text-[var(--color-muted)]"> / mes</span>
              </p>
              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-[var(--color-muted)]">{p.description}</p>

              <dl className="mt-5 space-y-3 border-t border-[var(--color-border)] pt-4 text-[12px]">
                <div>
                  <dt className="text-[var(--color-subtle)]">Espacios incluidos</dt>
                  <dd className="num mt-1 text-[var(--color-muted)]">{p.slots.join(', ')}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-subtle)]">Entrega estimada</dt>
                  <dd className="num mt-1 text-[var(--color-muted)]">
                    {p.impressionsIncluded
                      ? `${p.impressionsIncluded.toLocaleString('es-ES')} impresiones sujetas a inventario`
                      : 'Se cotiza con inventario histórico verificado'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-subtle)]">Reporte</dt>
                  <dd className="mt-1 text-[var(--color-muted)]">{p.reporting.join(' · ')}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-subtle)]">Condiciones</dt>
                  <dd className="mt-1 space-y-1 text-[var(--color-muted)]">
                    {p.restrictions.map((r) => (
                      <span key={r} className="block">
                        · {r}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-[var(--color-subtle)]">
          El piloto evaluará CPM, CPC, precio fijo y patrocinios solo después de habilitar medición verificable.
          Actualmente no contratamos ni facturamos impresiones; tampoco prometemos inventario que el producto aún
          no haya demostrado.
        </p>
      </section>

      {/* Inventario */}
      <section className="mt-16">
        <h2 className="text-xl font-semibold tracking-tight">Inventario diseñado · pendiente de activación</h2>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-[13px]">
            <caption className="sr-only">Espacios publicitarios disponibles</caption>
            <thead>
              <tr className="border-b border-[var(--color-border-strong)] text-[var(--color-muted)]">
                <th scope="col" className="px-3 py-2.5 text-left font-medium">Espacio</th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">Formato</th>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">Superficie</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Alto reservado</th>
              </tr>
            </thead>
            <tbody>
              {AD_SLOTS.filter((slot) => LIVE_AD_SLOT_CODES.has(slot.code)).map((s) => (
                <tr key={s.code} className="border-b border-[var(--color-border)]">
                  <td className="px-3 py-2.5">
                    <span className="block font-medium">{s.label}</span>
                    <span className="num block text-[11px] text-[var(--color-subtle)]">{s.code}</span>
                  </td>
                  <td className="num px-3 py-2.5 text-[var(--color-muted)]">{s.format}</td>
                  <td className="num px-3 py-2.5 text-[var(--color-muted)]">{s.surface}</td>
                  <td className="num px-3 py-2.5 text-right text-[var(--color-muted)]">
                    {s.reservedHeight ? `${s.reservedHeight} px` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-subtle)]">
          Todos los espacios reservan su alto antes de solicitar la creatividad, de modo que la publicidad nunca
          desplaza el contenido. Si no hay relleno, aparece contenido propio contextual sin seguimiento y se conserva
          la geometría de la página.
        </p>
      </section>

      {/* Normas */}
      <section className="mt-16 grid gap-4 lg:grid-cols-2">
        <Card className="border-[color-mix(in_srgb,var(--color-negative)_22%,transparent)] bg-[var(--color-negative-soft)] p-6">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--color-negative)]">
            <X className="size-4" aria-hidden="true" />
            Dónde no aparece publicidad
          </h2>
          <ul className="mt-4 space-y-2">
            {FORBIDDEN_SURFACES.map((s) => (
              <li key={s} className="text-[13px] leading-relaxed text-[var(--color-muted)]">
                · {FORBIDDEN_LABELS[s] ?? s}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] leading-relaxed text-[var(--color-subtle)]">
            Esta restricción está implementada en el servidor y en el propio componente de renderizado: no
            depende de la configuración de cada campaña ni puede saltarse por error.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Check className="size-4 text-[var(--color-positive)]" aria-hidden="true" />
            Normas editoriales
          </h2>
          <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
            {[
              'Todo contenido patrocinado se etiqueta de forma visible e ineludible.',
              'Se rechazan promesas de rentabilidad, garantías de resultado y venta de señales de trading.',
              'Se rechazan esquemas piramidales, multinivel y plataformas de inversión no verificadas.',
              'Se rechazan creatividades que imiten botones o terminología del producto.',
              'Los anunciantes financieros pasan revisión manual de cumplimiento antes de activarse.',
              'La segmentación nunca usa información financiera del usuario ni inferencias sobre su situación económica.',
              'Un patrocinador de ruta educativa no puede intervenir en el contenido, las evaluaciones ni las recomendaciones.',
              'Los usuarios del plan Premium no ven publicidad; los de Standard reciben densidad reducida y ningún interstitial.',
            ].map((t) => (
              <li key={t}>· {t}</li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="mt-14 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <h2 className="text-xl font-semibold tracking-tight">¿Te encaja este marco?</h2>
        <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-[var(--color-muted)]">
          Escríbenos con tu producto, audiencia y formato para entrar en la lista del piloto. Te contactaremos
          cuando AdSense o la medición directa estén aprobados y exista inventario histórico verificable.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/contacto">
            <Button size="lg">Solicitar acceso al piloto</Button>
          </Link>
          <Link href="/legal/publicidad">
            <Button size="lg" variant="outline">
              Leer la política publicitaria
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
