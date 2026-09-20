import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Brain,
  BookOpen,
  Check,
  ClipboardList,
  GraduationCap,
  Layers,
  LineChart,
  LockKeyhole,
  MessageCircleQuestion,
  Newspaper,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Badge, Button, Card, cn } from '@tl/ui';
import { ASSET_CLASS_LABEL, PLANS, type AssetClass } from '@tl/types';
import { PLAN_ENTITLEMENTS, yearlyDiscountPercent } from '@tl/types/plans';
import { Float, Lift, Reveal, Stagger } from '@/components/motion/Motion';
import { PAYMENT_REGION_NOTICE, PAYMENT_REFERENCE_NOTICE } from '@/lib/payment-copy';

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <p className="marketing-eyebrow">
        <span className="marketing-eyebrow-dot" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className="marketing-heading mt-4">{title}</h2>
      {description && <p className="marketing-lede mt-5">{description}</p>}
    </div>
  );
}

const STEPS = [
  {
    icon: BookOpen,
    index: '01',
    title: 'Aprende una idea',
    body: 'Una lección breve te da el contexto y te pide demostrar que lo entendiste.',
    tone: 'blue',
  },
  {
    icon: LineChart,
    index: '02',
    title: 'Observa el mercado',
    body: 'Lleva ese concepto al gráfico y aprende a distinguir señal, contexto y ruido.',
    tone: 'violet',
  },
  {
    icon: Target,
    index: '03',
    title: 'Formula una hipótesis',
    body: 'Declara dirección, riesgo, confianza y el nivel que invalidaría tu lectura.',
    tone: 'gold',
  },
  {
    icon: Brain,
    index: '04',
    title: 'Revisa tu proceso',
    body: 'El entrenador devuelve preguntas y patrones para que la siguiente decisión sea mejor.',
    tone: 'positive',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="como-funciona" className="marketing-block marketing-story">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <Reveal>
            <SectionHeading
              eyebrow="El ciclo"
              align="left"
              title={
                <>
                  La decisión no termina en el gráfico.{' '}
                  <span className="text-[var(--color-blue)]">Ahí empieza.</span>
                </>
              }
              description="TradingLab convierte cada sesión en un ciclo de aprendizaje deliberado: estudias, aplicas, simulas y vuelves con evidencia."
            />
          </Reveal>
        </div>

        <Stagger className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Lift key={step.index} amount={5}>
                <article className="marketing-step-card group h-full">
                  <div className="flex items-start justify-between gap-4">
                    <span className={cn('marketing-icon-box', `marketing-icon-${step.tone}`)}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="num text-[11px] font-semibold text-[var(--color-subtle)]">{step.index}</span>
                  </div>
                  <h3 className="mt-8 text-[17px] font-semibold tracking-[-0.025em]">{step.title}</h3>
                  <p className="mt-2.5 text-[13px] leading-[1.7] text-[var(--color-muted)]">{step.body}</p>
                  <span className="mt-7 block h-px w-10 bg-[var(--color-blue)] transition-all duration-500 group-hover:w-20" />
                </article>
              </Lift>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

export interface MarketSummary {
  assetClass: AssetClass;
  count: number;
  description: string;
  risk: number;
  session: string;
  examples: string[];
  available: boolean;
}

const RISK_LABEL = ['', 'Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto'];

export function MarketsSection({ markets }: { markets: MarketSummary[] }) {
  return (
    <section id="mercados" className="marketing-band">
      <div className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="El contexto importa"
            title={
              <>
                No todos los mercados{' '}
                <span className="text-[var(--color-blue)]">hablan el mismo idioma.</span>
              </>
            }
            description="Aprende cómo cambian el horario, la volatilidad y los factores de cada familia de activos antes de formar una hipótesis."
          />
        </Reveal>

        <Stagger className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => (
            <Lift key={market.assetClass} amount={4}>
              <article className={cn('marketing-market-card group', !market.available && 'opacity-70')}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="num text-[10px] uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                      {market.assetClass}
                    </p>
                    <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.025em] transition-colors group-hover:text-[var(--color-blue)]">
                      {ASSET_CLASS_LABEL[market.assetClass]}
                    </h3>
                  </div>
                  {market.available ? <Badge tone="blue">{market.count} activos</Badge> : <Badge>Próximamente</Badge>}
                </div>
                <p className="mt-5 min-h-16 text-[13px] leading-[1.7] text-[var(--color-muted)]">{market.description}</p>
                <div className="mt-6 flex items-end justify-between gap-3 border-t border-[var(--color-border)] pt-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-subtle)]">Riesgo educativo</p>
                    <div className="mt-2 flex items-center gap-2">
                      <RiskDots level={market.risk} />
                      <span className="text-[11px] text-[var(--color-muted)]">{RISK_LABEL[market.risk]}</span>
                    </div>
                  </div>
                  <p className="num text-right text-[11px] text-[var(--color-subtle)]">
                    {market.examples.join(' · ') || 'Sin instrumentos'}
                  </p>
                </div>
              </article>
            </Lift>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function RiskDots({ level }: { level: number }) {
  return (
    <span className="flex gap-1" aria-label={`Nivel ${level} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            'size-1.5 rounded-full',
            i <= level
              ? level >= 4
                ? 'bg-[var(--color-negative)]'
                : level === 3
                  ? 'bg-[var(--color-gold)]'
                  : 'bg-[var(--color-positive)]'
              : 'bg-[var(--color-border-strong)]',
          )}
        />
      ))}
    </span>
  );
}

const AI_CAPABILITIES = [
  { icon: LineChart, title: 'Describe el contexto', body: 'Traduce estructura, indicadores y volatilidad a lenguaje claro.' },
  { icon: Scale, title: 'Compara escenarios', body: 'Construye lecturas alcistas y bajistas sin fingir certeza.' },
  { icon: AlertTriangle, title: 'Hace visibles los riesgos', body: 'Señala eventos, contradicciones y niveles de invalidación.' },
  { icon: ClipboardList, title: 'Te devuelve preguntas', body: 'La respuesta termina donde empieza tu criterio.' },
] as const;

export function AICoachSection() {
  return (
    <section id="entrenador-ia" className="marketing-block marketing-ai-scene relative overflow-hidden">
      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
        <Reveal>
          <SectionHeading
            eyebrow="Entrenador educativo"
            align="left"
            title={
              <>
                Un tutor que te ayuda a{' '}
                <span className="text-[var(--color-violet)]">pensar mejor.</span>
              </>
            }
            description="La IA no es una señal de compra. Es una segunda mirada que explica el contexto, presenta escenarios y te obliga a declarar qué invalidaría tu idea."
          />

          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {AI_CAPABILITIES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3.5 rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_76%,transparent)] p-4 backdrop-blur-xl">
                  <span className="marketing-icon-box marketing-icon-violet size-9 shrink-0">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-[13px] font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <Float distance={8} duration={9}>
            <div className="marketing-coach-console">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-xl bg-[var(--color-violet-soft)] text-[var(--color-violet)]">
                    <Sparkles className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold">Entrenador educativo</p>
                    <p className="text-[10px] text-[var(--color-subtle)]">Contexto verificado · respuesta estructurada</p>
                  </div>
                </div>
                <Badge tone="violet">Sin órdenes</Badge>
              </div>

              <div className="space-y-4 p-5">
                <div className="max-w-[82%] rounded-2xl rounded-tl-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">Lectura</p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-[var(--color-text)]">
                    El precio mantiene una estructura de corto plazo compatible con dos escenarios. La evidencia no es suficiente para convertirla en una certeza.
                  </p>
                </div>
                <div className="ml-auto max-w-[74%] rounded-2xl rounded-tr-md bg-[var(--color-blue)] p-4 text-white shadow-[var(--shadow-focus)]">
                  <p className="text-[12px] leading-relaxed">¿Qué tendría que ocurrir para que mi hipótesis dejara de ser válida?</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ScenarioCard tone="positive" label="Escenario alcista" text="Recuperación sobre la media con riesgo contenido." />
                  <ScenarioCard tone="negative" label="Escenario bajista" text="Pérdida del soporte y mayor volatilidad." />
                </div>
                <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-4 text-[11px] text-[var(--color-muted)]">
                  <MessageCircleQuestion className="size-3.5 text-[var(--color-violet)]" aria-hidden="true" />
                  <span>La siguiente decisión sigue siendo tuya.</span>
                </div>
              </div>
            </div>
          </Float>
        </Reveal>
      </div>
    </section>
  );
}

function ScenarioCard({ tone, label, text }: { tone: 'positive' | 'negative'; label: string; text: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-3.5',
        tone === 'positive'
          ? 'border-[color-mix(in_srgb,var(--color-positive)_26%,transparent)] bg-[var(--color-positive-soft)]'
          : 'border-[color-mix(in_srgb,var(--color-negative)_26%,transparent)] bg-[var(--color-negative-soft)]',
      )}
    >
      <p className={cn('text-[10px] font-semibold uppercase tracking-[0.13em]', tone === 'positive' ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]')}>
        {label}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted)]">{text}</p>
    </div>
  );
}

export interface TrackSummary {
  slug: string;
  title: string;
  summary: string;
  level: string;
  lessons: number;
  minutes: number;
}

export function AcademySection({ tracks }: { tracks: TrackSummary[] }) {
  const visibleTracks = tracks.slice(0, 6);

  return (
    <section id="academia" className="marketing-band">
      <div className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Academia"
            title={
              <>
                Una ruta que convierte curiosidad en{' '}
                <span className="text-[var(--color-blue)]">criterio.</span>
              </>
            }
            description="La progresión no se mide por cuánto contenido consumes. Se mide por lo que puedes explicar, aplicar y revisar."
          />
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
          <Reveal>
            <div className="marketing-path-card h-full">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="marketing-eyebrow">Tu ruta</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Del primer concepto a tu propia estrategia.</h3>
                </div>
                <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--color-blue-soft)] text-[var(--color-blue)]">
                  <GraduationCap className="size-5" aria-hidden="true" />
                </span>
              </div>
              <div className="relative mt-10 space-y-5 pl-8">
                <span className="absolute bottom-3 left-[9px] top-3 w-px bg-[linear-gradient(var(--color-blue),var(--color-violet),var(--color-border))]" aria-hidden="true" />
                {['Entender el mercado', 'Leer el gráfico', 'Medir el riesgo', 'Practicar una hipótesis', 'Revisar el proceso'].map((label, index) => (
                  <div key={label} className="relative flex items-center gap-3">
                    <span className={cn('absolute -left-8 flex size-5 items-center justify-center rounded-full border text-[9px] font-semibold', index < 2 ? 'border-[var(--color-blue)] bg-[var(--color-blue)] text-white' : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-subtle)]')}>
                      {index < 2 ? <Check className="size-3" aria-hidden="true" /> : index + 1}
                    </span>
                    <span className={cn('text-[13px]', index < 2 ? 'font-medium text-[var(--color-text)]' : 'text-[var(--color-muted)]')}>{label}</span>
                  </div>
                ))}
              </div>
              <Link href="/recursos" className="mt-10 inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--color-blue)]">
                Explorar la ruta completa <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </Reveal>

          <Stagger className="grid gap-3 sm:grid-cols-2">
            {visibleTracks.map((track, index) => (
              <Lift key={track.slug} amount={4}>
                <Link href="/recursos" className="marketing-track-card group block h-full">
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={track.level === 'BASICO' ? 'positive' : track.level === 'INTERMEDIO' ? 'blue' : 'violet'}>
                      {track.level === 'BASICO' ? 'Básico' : track.level === 'INTERMEDIO' ? 'Intermedio' : 'Avanzado'}
                    </Badge>
                    <span className="num text-[10px] text-[var(--color-subtle)]">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-[15px] font-semibold tracking-[-0.02em] transition-colors group-hover:text-[var(--color-blue)]">{track.title}</h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-muted)]">{track.summary}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-[10px] text-[var(--color-subtle)]">
                    <span>{track.lessons} lecciones</span>
                    <span>{track.minutes} min</span>
                  </div>
                </Link>
              </Lift>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}

const RECOGNITIONS = [
  { icon: ShieldCheck, label: 'Uso disciplinado del stop loss' },
  { icon: Scale, label: 'Relación riesgo-beneficio equilibrada' },
  { icon: ClipboardList, label: 'Calidad del diario de decisiones' },
  { icon: Wallet, label: 'Riesgo contenido por operación' },
  { icon: BookOpen, label: 'Finalización de cursos y evaluaciones' },
  { icon: Newspaper, label: 'Lectura razonada de eventos económicos' },
];

export function PhilosophySection() {
  return (
    <section className="marketing-block">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
        <Reveal>
          <SectionHeading
            eyebrow="La métrica que importa"
            align="left"
            title={
              <>
                No premiamos quién gana más.{' '}
                <span className="text-[var(--color-blue)]">Premiamos quién decide mejor.</span>
              </>
            }
            description="La rentabilidad virtual de una muestra pequeña es ruido. El proceso —riesgo, invalidación, documentación y repetición— sí se puede mejorar."
          />
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
              <LockKeyhole className="size-4" aria-hidden="true" />
            </span>
            <p className="text-[12px] leading-relaxed text-[var(--color-muted)]">Tu saldo es virtual. Tu aprendizaje es real.</p>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="space-y-5">
            <div className="marketing-discipline-image">
              <Image
                src="/images/tradinglab-discipline.webp"
                alt="Composición editorial que representa el progreso disciplinado"
                fill
                sizes="(max-width: 1024px) 100vw, 52vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,#07101fcc)]" />
              <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4 text-white sm:inset-x-7 sm:bottom-7">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-white/65">Objetivo de la sesión</p>
                  <p className="mt-1 text-xl font-semibold tracking-[-0.03em]">Construir criterio antes de buscar resultados.</p>
                </div>
                <span className="num hidden text-[12px] text-white/65 sm:block">01 / 05</span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {RECOGNITIONS.map((recognition) => {
                const Icon = recognition.icon;
                return (
                  <div key={recognition.label} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
                    <Icon className="size-4 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
                    <span className="text-[12px] leading-snug">{recognition.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function PricingSection({
  compact = false,
  showHeading = true,
}: {
  compact?: boolean;
  showHeading?: boolean;
}) {
  return (
    <section id="precios" className="marketing-band">
      <div className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        {showHeading && (
          <Reveal>
            <SectionHeading
              eyebrow="Planes"
              title={
                <>
                  Empieza sin fricción.{' '}
                  <span className="text-[var(--color-blue)]">Crece cuando estés listo.</span>
                </>
              }
              description="Sin cargos ocultos, sin patrones oscuros y con cancelación en dos clics desde tu perfil."
            />
          </Reveal>
        )}

        <Stagger className={cn(showHeading && 'mt-14', 'grid gap-3 lg:grid-cols-3')}>
          {PLANS.map((id) => {
            const plan = PLAN_ENTITLEMENTS[id];
            const featured = id === 'STANDARD';
            const discount = yearlyDiscountPercent(id);

            return (
              <Lift key={id} amount={featured ? 7 : 4}>
                <Card
                  className={cn(
                    'marketing-plan-card relative flex h-full flex-col p-6',
                    featured && 'marketing-plan-featured',
                  )}
                >
                  {featured && <span className="marketing-plan-ribbon">Recomendado</span>}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="num text-[10px] uppercase tracking-[0.16em] text-[var(--color-subtle)]">{id}</p>
                      <h3 className="mt-2 text-lg font-semibold tracking-[-0.025em]">{plan.name}</h3>
                    </div>
                    {featured && <Sparkles className="size-4 text-[var(--color-blue)]" aria-hidden="true" />}
                  </div>
                  <p className="mt-2 text-[13px] text-[var(--color-muted)]">{plan.tagline}</p>
                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="num text-3xl font-semibold tracking-[-0.04em]">
                      {plan.priceMonthlyUsd === 0 ? 'USD 0' : `USD ${plan.priceMonthlyUsd.toFixed(2)}`}
                    </span>
                    {plan.priceMonthlyUsd > 0 && <span className="text-[12px] text-[var(--color-muted)]">/ mes</span>}
                  </div>
                  {plan.priceYearlyUsd > 0 && (
                    <>
                      <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                        o USD {plan.priceYearlyUsd} al año <span className="text-[var(--color-positive)]">({discount}% de descuento)</span>
                      </p>
                      <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-subtle)]">
                        {PAYMENT_REFERENCE_NOTICE}
                      </p>
                    </>
                  )}
                  <ul className="mt-7 flex-1 space-y-3">
                    {(compact ? plan.highlights.slice(0, 7) : plan.highlights).map((highlight) => (
                      <li key={highlight} className="flex gap-2.5 text-[12px] leading-snug text-[var(--color-muted)]">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--color-blue)]" aria-hidden="true" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8 space-y-2">
                    <Link
                      href={id === 'FREE' ? '/crear-cuenta' : `/crear-cuenta?plan=${id}&interval=MONTHLY`}
                      className="block"
                    >
                      <Button variant={featured ? 'primary' : 'secondary'} fullWidth>
                        {id === 'FREE' ? 'Crear mi cuenta DEMO' : `Elegir ${plan.name} mensual`}
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Button>
                    </Link>
                    {id !== 'FREE' && (
                      <Link
                        href={`/crear-cuenta?plan=${id}&interval=YEARLY`}
                        className="block rounded-[var(--radius-sm)] px-3 py-2 text-center text-[11px] font-semibold text-[var(--color-blue)] transition-colors hover:bg-[var(--color-blue-soft)]"
                      >
                        Elegir anual · ahorrar {discount}%
                      </Link>
                    )}
                  </div>
                </Card>
              </Lift>
            );
          })}
        </Stagger>

        <p className="mx-auto mt-8 max-w-3xl text-center text-[11px] leading-relaxed text-[var(--color-subtle)]">
          La suscripción da acceso a contenido educativo y herramientas de simulación. No otorga acceso a mercados reales, no constituye una inversión y no genera rendimiento alguno.
        </p>
      </div>
    </section>
  );
}

export const FAQ_ITEMS = [
  {
    q: '¿Estoy invirtiendo dinero real?',
    a: 'No. TradingLab no recibe dinero para inversión, no admite depósitos de capital de trading y no ejecuta ninguna orden en mercados reales. Todas las operaciones se realizan con saldo virtual, marcado como DEMO en toda la interfaz.',
  },
  {
    q: '¿Puedo retirar las ganancias DEMO?',
    a: 'No. El saldo virtual no es convertible ni transferible: es un instrumento pedagógico que existe para que puedas equivocarte sin consecuencias económicas. No existe ninguna función de retiro en la plataforma.',
  },
  {
    q: '¿La IA me dice exactamente qué comprar?',
    a: 'No, y está diseñada para no poder hacerlo. El entrenador describe lo que se observa, construye escenarios alcistas y bajistas, enumera riesgos e indica qué invalidaría cada hipótesis.',
  },
  {
    q: '¿Los precios son reales?',
    a: 'Depende de la configuración del proveedor de datos, y siempre te lo decimos: junto a cada gráfico y cotización aparece la fuente, el estado del mercado y la latencia. Cuando la serie proviene del motor educativo determinístico, se indica de forma explícita.',
  },
  {
    q: '¿Necesito experiencia previa?',
    a: 'No. La ruta de mercados financieros desde cero empieza suponiendo que no sabes qué es una vela. La evaluación inicial sirve para recomendarte el punto de partida adecuado.',
  },
  {
    q: '¿La plataforma es un broker?',
    a: 'No. TradingLab es una plataforma educativa de análisis y simulación. No es un broker regulado, no custodia fondos ni activos y no intermedia inversiones.',
  },
  {
    q: '¿Qué incluye cada plan?',
    a: `Explore es gratuito e incluye academia básica, diario, ${PLAN_ENTITLEMENTS.FREE.simulationsPerDay} simulaciones al día y ${PLAN_ENTITLEMENTS.FREE.aiAnalysesPerMonth} análisis educativos con IA al mes. Plus amplía la práctica, el historial, los indicadores y las estadísticas, sin publicidad. Pro incluye la academia completa, ${PLAN_ENTITLEMENTS.PREMIUM.aiAnalysesPerMonth} análisis mensuales y diez años de historial. Todos usan saldo virtual. Teams se prepara mediante una propuesta para cada equipo.`,
  },
  {
    q: '¿En qué moneda se procesa mi pago?',
    a: `${PAYMENT_REGION_NOTICE} ${PAYMENT_REFERENCE_NOTICE} El saldo DEMO de USD 10.000 es virtual y no es el importe de una compra.`,
  },
] as const;

export function FAQSection() {
  return (
    <section id="preguntas" className="marketing-block">
      <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <Reveal>
          <SectionHeading eyebrow="Preguntas frecuentes" title="Lo importante, claro desde el principio." />
        </Reveal>
        <div className="mt-12 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {FAQ_ITEMS.map((item, index) => (
            <details key={item.q} className="marketing-faq group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-5 text-[14px] font-medium">
                <span className="flex gap-3">
                  <span className="num text-[10px] text-[var(--color-subtle)]">0{index + 1}</span>
                  {item.q}
                </span>
                <span aria-hidden="true" className="text-xl font-light text-[var(--color-muted)] transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 pl-7 pr-8 text-[13px] leading-[1.75] text-[var(--color-muted)]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section className="marketing-final-cta relative overflow-hidden border-t border-[var(--color-border)]">
      <div className="relative mx-auto max-w-3xl px-5 py-28 text-center sm:px-8">
        <Reveal>
          <p className="marketing-eyebrow justify-center">Tu siguiente sesión</p>
          <h2 className="marketing-heading mt-5">
            Empieza por la parte que no cuesta dinero:{' '}
            <span className="text-[var(--color-blue)]">entender.</span>
          </h2>
          <p className="marketing-lede mx-auto mt-5 max-w-xl">
            Crea tu cuenta DEMO, recibe USD 10.000 virtuales y completa tu primera lección. Sin tarjeta, sin depósitos y sin promesas de rentabilidad.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/crear-cuenta">
              <Button size="lg" className="rounded-[12px] px-7">
                Crear mi cuenta DEMO
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/recursos">
              <Button size="lg" variant="outline" className="rounded-[12px] px-7">Explorar la academia</Button>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
