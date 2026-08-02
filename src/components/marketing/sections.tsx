import Link from 'next/link';
import Image from 'next/image';
import {
  BookOpen,
  Brain,
  ClipboardList,
  LineChart,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Scale,
  Newspaper,
  Layers,
} from 'lucide-react';
import { Badge, Button, Card, cn } from '@tl/ui';
import { ASSET_CLASS_LABEL, PLANS, type AssetClass } from '@tl/types';
import { PLAN_ENTITLEMENTS, yearlyDiscountPercent } from '@tl/types/plans';

/* ═══════════════════════════════════════════════════════════════════════════
   Secciones de la landing. Todas son componentes de servidor.
   ═══════════════════════════════════════════════════════════════════════════ */

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
      <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-blue)]">
        <span className="size-1.5 rounded-full bg-[var(--color-blue)]" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className="mt-4 text-[2.2rem] font-semibold leading-[1.02] tracking-[-0.05em] sm:text-5xl">{title}</h2>
      {description && (
        <p className="mt-5 text-[15px] leading-[1.7] text-[var(--color-muted)]">{description}</p>
      )}
    </div>
  );
}

// ── Cómo funciona ───────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: BookOpen,
    title: 'Aprende un concepto',
    body: 'Cada lección explica una idea, la ilustra con un ejemplo y te pide aplicarla. No avanzas por ver un vídeo: avanzas cuando demuestras que lo entendiste.',
  },
  {
    icon: LineChart,
    title: 'Analiza un activo',
    body: 'Abre el gráfico, aplica los indicadores que acabas de estudiar y escribe qué observas. La fuente y la latencia del precio están siempre a la vista.',
  },
  {
    icon: Target,
    title: 'Simula una operación',
    body: 'Formula una hipótesis alcista o bajista con dinero virtual. Antes de confirmar declaras tu motivo, tu nivel de confianza y qué invalidaría tu idea.',
  },
  {
    icon: Brain,
    title: 'Revisa tus resultados con IA',
    body: 'El entrenador compara tu plan con lo que hiciste, señala riesgos que no viste y te devuelve preguntas. Evalúa el proceso, no solo el resultado.',
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
      <SectionHeading
        eyebrow="Cómo funciona"
        title="Un ciclo de cuatro pasos que se repite"
        description="La plataforma está construida alrededor de un bucle de aprendizaje deliberado: estudias, aplicas, arriesgas capital virtual y revisas con evidencia."
      />

      <ol className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <Card className="group relative h-full overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-blue)] hover:shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--color-blue-soft)] text-[var(--color-blue)] transition-transform duration-300 group-hover:scale-110">
                  <s.icon className="size-4.5" aria-hidden="true" />
                </span>
                <span className="num text-[11px] font-semibold text-[var(--color-subtle)]">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-6 text-[16px] font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2.5 text-[13px] leading-[1.7] text-[var(--color-muted)]">{s.body}</p>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── Mercados ────────────────────────────────────────────────────────────────

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
    <section id="mercados" className="border-y border-[var(--color-border)] bg-[var(--color-overlay)]">
      <div className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <SectionHeading
          eyebrow="Mercados"
          title="Seis familias de activos, con su propio comportamiento"
          description="Cada mercado tiene un horario, un nivel de volatilidad y unos factores que lo mueven. Aprender las diferencias es parte del programa."
        />

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((m) => (
              <Card key={m.assetClass} className={cn('group p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]', !m.available && 'opacity-60')}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[16px] font-semibold tracking-tight transition-colors group-hover:text-[var(--color-blue)]">
                  {ASSET_CLASS_LABEL[m.assetClass]}
                </h3>
                {m.available ? (
                  <Badge tone="blue">{m.count} instrumentos</Badge>
                ) : (
                  <Badge tone="neutral">Próximamente</Badge>
                )}
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-muted)]">
                {m.description}
              </p>
              <dl className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--color-subtle)]">Riesgo educativo</dt>
                  <dd className="flex items-center gap-1.5">
                    <RiskDots level={m.risk} />
                    <span className="text-[var(--color-muted)]">{RISK_LABEL[m.risk]}</span>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="shrink-0 text-[var(--color-subtle)]">Horario de referencia</dt>
                  <dd className="text-right text-[var(--color-muted)]">{m.session}</dd>
                </div>
              </dl>
              {m.examples.length > 0 && (
                <p className="num mt-3 text-[11px] text-[var(--color-subtle)]">
                  {m.examples.join(' · ')}
                </p>
              )}
            </Card>
          ))}
        </div>

        <p className="mt-8 text-center text-[12px] text-[var(--color-subtle)]">
          Los ETF se incorporarán cuando exista una fuente de datos autorizada que los cubra con licencia
          adecuada.
        </p>
      </div>
    </section>
  );
}

function RiskDots({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`Nivel ${level} de 5`}>
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

// ── Entrenador IA ───────────────────────────────────────────────────────────

const AI_CAPABILITIES = [
  { icon: LineChart, title: 'Explica lo que estás viendo', body: 'Traduce la estructura del gráfico y las lecturas de tus indicadores a lenguaje claro.' },
  { icon: Layers, title: 'Detecta confluencias y contradicciones', body: 'Señala cuándo varias señales apuntan al mismo sitio y, sobre todo, cuándo se contradicen.' },
  { icon: TrendingUp, title: 'Formula ambos escenarios', body: 'Siempre construye la hipótesis alcista y la bajista, en condicional, con niveles concretos.' },
  { icon: AlertTriangle, title: 'Identifica riesgos', body: 'Volatilidad reciente, eventos próximos, limitaciones de la temporalidad que estás mirando.' },
  { icon: ClipboardList, title: 'Te hace preguntas', body: 'No cierra la conclusión por ti: te devuelve las preguntas que deberías responder antes de decidir.' },
  { icon: ShieldCheck, title: 'Nunca promete resultados', body: 'No da órdenes de compra o venta, no inventa precios ni noticias y declara siempre su nivel de incertidumbre.' },
];

export function AICoachSection() {
  return (
    <section id="entrenador-ia" className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
      <SectionHeading
        eyebrow="Entrenador con inteligencia artificial"
        title="Un tutor que discute contigo, no un oráculo"
        description="El entrenador recibe del servidor los precios y los indicadores ya calculados. No puede inventarlos, no puede modificar el resultado de tus simulaciones y no puede darte una orden de compra o venta."
      />

      <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {AI_CAPABILITIES.map((c) => (
          <Card key={c.title} className="group p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--color-violet-soft)] text-[var(--color-violet)] transition-transform duration-300 group-hover:scale-110">
              <c.icon className="size-4.5" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-[15px] font-semibold tracking-tight">{c.title}</h3>
            <p className="mt-2 text-[13px] leading-[1.7] text-[var(--color-muted)]">{c.body}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="border-[color-mix(in_srgb,var(--color-negative)_22%,transparent)] bg-[var(--color-negative-soft)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-negative)]">
            Lo que nunca vas a leer
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)] line-through decoration-[var(--color-negative)]/60">
            «Compra EUR/USD ahora porque va a subir.»
          </p>
        </Card>
        <Card className="border-[color-mix(in_srgb,var(--color-positive)_22%,transparent)] bg-[var(--color-positive-soft)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-positive)]">
            Lo que sí vas a leer
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-text)]">
            «El precio presenta algunas señales compatibles con un escenario alcista, pero también existen
            factores que podrían invalidarlo. Antes de crear una simulación, identifica el nivel que demostraría
            que tu hipótesis es incorrecta y define cuánto saldo virtual estás dispuesto a arriesgar.»
          </p>
        </Card>
      </div>
    </section>
  );
}

// ── Academia ────────────────────────────────────────────────────────────────

export interface TrackSummary {
  slug: string;
  title: string;
  summary: string;
  level: string;
  lessons: number;
  minutes: number;
}

export function AcademySection({ tracks }: { tracks: TrackSummary[] }) {
  return (
    <section
      id="academia"
      className="border-y border-[var(--color-border)] bg-[var(--color-overlay)]"
    >
      <div className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <SectionHeading
          eyebrow="Academia"
          title="Rutas que van del primer concepto a tu propia estrategia"
          description="Cada lección combina explicación, ejemplo, pregunta, ejercicio, simulación y evaluación. La progresión exige demostrar comprensión."
        />

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((t) => (
            <Link
              key={t.slug}
              href="/recursos"
              className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-blue)]"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone={t.level === 'BASICO' ? 'positive' : t.level === 'INTERMEDIO' ? 'blue' : 'violet'}>
                  {t.level === 'BASICO' ? 'Básico' : t.level === 'INTERMEDIO' ? 'Intermedio' : 'Avanzado'}
                </Badge>
                <span className="num text-[10px] text-[var(--color-subtle)]">
                  {t.lessons} lecciones · {t.minutes} min
                </span>
              </div>
              <h3 className="mt-3.5 text-[14px] font-semibold tracking-tight transition-colors group-hover:text-[var(--color-blue)]">
                {t.title}
              </h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-muted)]">{t.summary}</p>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/recursos">
            <Button variant="outline">Explorar la academia completa</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Reconocimientos ─────────────────────────────────────────────────────────

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
    <section className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Nuestro criterio"
            title={
              <>
                No premiamos <span className="editorial italic">quién gana más</span>. Premiamos quién decide
                mejor.
              </>
            }
            description="La rentabilidad virtual de una muestra pequeña es ruido. Lo que sí puedes controlar y mejorar desde el primer día es el proceso: cómo dimensionas el riesgo, si defines invalidación, si documentas y si repites errores."
            align="left"
          />
          <p className="mt-6 text-[13px] leading-relaxed text-[var(--color-muted)]">
            Por eso el indicador de cabecera de tu perfil es una puntuación de disciplina, y los retos y las
            insignias miden conducta, no beneficio. No hay cajas de recompensa, ni giros, ni mecánicas de
            casino.
          </p>
        </div>

        <div className="space-y-5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-lifted)]">
            <Image
              src="/images/tradinglab-discipline.webp"
              alt="Cuaderno abierto con un gráfico dibujado y elementos que representan disciplina"
              fill
              sizes="(max-width: 1024px) 100vw, 48vw"
              className="object-cover"
            />
            <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/50 bg-white/75 p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:inset-x-6 sm:bottom-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-blue)]">El objetivo</p>
              <p className="mt-1 text-[15px] font-medium tracking-tight text-[var(--color-text)]">Construir criterio antes de buscar resultados.</p>
            </div>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {RECOGNITIONS.map((r) => (
              <li
                key={r.label}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
                  <r.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-[13px] leading-snug">{r.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ── Planes ──────────────────────────────────────────────────────────────────

export function PricingSection({ compact = false }: { compact?: boolean }) {
  return (
    <section id="precios" className="border-y border-[var(--color-border)] bg-[var(--color-overlay)]">
      <div className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <SectionHeading
          eyebrow="Planes"
          title="Precios transparentes, sin cargos ocultos"
          description="Puedes cancelar cuando quieras desde tu perfil, en dos clics. Te avisamos antes de cada renovación. No usamos patrones oscuros."
        />

        <div className="mt-16 grid gap-4 lg:grid-cols-3">
          {PLANS.map((id) => {
            const plan = PLAN_ENTITLEMENTS[id];
            const featured = id === 'STANDARD';
            const discount = yearlyDiscountPercent(id);

            return (
              <Card
                key={id}
                className={cn(
                  'relative flex flex-col p-6',
                  featured &&
                    'border-[var(--color-blue)] shadow-[var(--shadow-glow-blue)] lg:-my-3 lg:py-9',
                )}
              >
                {featured && (
                  <span className="absolute -top-2.5 left-6 rounded-full bg-[var(--color-blue)] px-2.5 py-1 text-[10px] font-semibold text-white">
                    El más elegido
                  </span>
                )}
                <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
                <p className="mt-1 text-[13px] text-[var(--color-muted)]">{plan.tagline}</p>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="num text-3xl font-semibold tracking-tight">
                    {plan.priceMonthlyUsd === 0 ? 'USD 0' : `USD ${plan.priceMonthlyUsd.toFixed(2)}`}
                  </span>
                  {plan.priceMonthlyUsd > 0 && (
                    <span className="text-[13px] text-[var(--color-muted)]">/ mes</span>
                  )}
                </div>
                {plan.priceYearlyUsd > 0 && (
                  <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                    o USD {plan.priceYearlyUsd} al año{' '}
                    <span className="text-[var(--color-positive)]">({discount} % de descuento)</span>
                  </p>
                )}

                <ul className="mt-6 flex-1 space-y-2">
                  {(compact ? plan.highlights.slice(0, 8) : plan.highlights).map((h) => (
                    <li key={h} className="flex gap-2.5 text-[13px] leading-snug text-[var(--color-muted)]">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--color-blue)]" aria-hidden="true" />
                      {h}
                    </li>
                  ))}
                </ul>

                <Link href="/crear-cuenta" className="mt-7 block">
                  <Button variant={featured ? 'primary' : 'secondary'} fullWidth>
                    {id === 'FREE' ? 'Crear mi cuenta DEMO' : `Comenzar con ${plan.name}`}
                  </Button>
                </Link>
              </Card>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[12px] leading-relaxed text-[var(--color-subtle)]">
          La suscripción da acceso a contenido educativo y a herramientas de simulación. No otorga acceso a
          mercados reales, no constituye una inversión y no genera rendimiento alguno. Prueba de Premium de
          7 días disponible al registrarte, sin promesas de resultados.
        </p>
      </div>
    </section>
  );
}

// ── Preguntas frecuentes ────────────────────────────────────────────────────

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
    a: 'No, y está diseñada para no poder hacerlo. El entrenador describe lo que se observa, construye los escenarios alcista y bajista, enumera riesgos e indica qué invalidaría cada hipótesis. Tiene prohibido dar órdenes imperativas de compra o venta, garantizar resultados e inventar precios o noticias. Un sistema de guardarraíles revisa cada respuesta antes de mostrártela.',
  },
  {
    q: '¿Los precios son reales?',
    a: 'Depende de la configuración del proveedor de datos, y siempre te lo decimos: junto a cada gráfico y a cada cotización aparece la fuente, el estado del mercado y la latencia. Cuando la serie proviene de nuestro motor educativo determinístico en lugar de un mercado real, se indica de forma explícita.',
  },
  {
    q: '¿Necesito experiencia previa?',
    a: 'No. La ruta «Mercados financieros desde cero» empieza suponiendo que no sabes qué es una vela. La evaluación inicial del registro sirve precisamente para recomendarte el punto de partida adecuado.',
  },
  {
    q: '¿Puedo reiniciar mi saldo virtual?',
    a: 'Sí, con un límite mensual según tu plan: una vez al mes en Free, cuatro en Standard y diez en Premium. El reinicio queda registrado en el libro mayor de tu cuenta: no borramos tu historial, añadimos el asiento correspondiente.',
  },
  {
    q: '¿La plataforma es un broker?',
    a: 'No. TradingLab es una plataforma educativa de análisis y simulación de mercados financieros. No es un broker regulado, no custodia fondos ni activos y no intermedia inversiones. Si en algún momento decides operar con dinero real, deberás hacerlo a través de una entidad autorizada en tu jurisdicción.',
  },
  {
    q: '¿Qué incluye cada plan?',
    a: 'Free incluye USD 10.000 virtuales, 20 simulaciones al día, cinco análisis con IA diarios, academia básica y un portafolio DEMO. Standard añade simulaciones ilimitadas bajo uso razonable, posiciones con stop loss y take profit, indicadores avanzados, diario completo y certificados. Premium añade análisis multitemporal, comparación de estrategias, backtesting avanzado, informes semanales y cero publicidad.',
  },
  {
    q: '¿Cómo se administran los anuncios?',
    a: 'Todo espacio comercial se etiqueta visiblemente como patrocinado. Nunca colocamos anuncios sobre el gráfico, dentro del formulario de una operación, en la confirmación de una simulación, en las alertas de riesgo ni junto a los análisis de la IA. Revisamos manualmente a los anunciantes financieros y rechazamos cualquier creatividad que prometa rentabilidad o imite elementos del producto. Los usuarios Premium no ven publicidad.',
  },
];

export function FAQSection() {
  return (
    <section id="preguntas" className="mx-auto max-w-3xl px-5 py-24">
      <SectionHeading eyebrow="Preguntas frecuentes" title="Lo que conviene dejar claro desde el principio" />

      <div className="mt-12 divide-y divide-[var(--color-border)]">
        {FAQ_ITEMS.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-medium">
              {item.q}
              <span
                aria-hidden="true"
                className="mt-1 shrink-0 text-[var(--color-muted)] transition-transform duration-300 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 pr-8 text-[13px] leading-relaxed text-[var(--color-muted)]">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ── Llamada final ───────────────────────────────────────────────────────────

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-[var(--color-border)]">
      <div aria-hidden="true" className="mesh-aurora absolute inset-0 opacity-70" />
      <div className="relative mx-auto max-w-3xl px-5 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Empieza por la parte que no cuesta dinero:{' '}
          <span className="editorial italic">entender</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Crea tu cuenta DEMO, recibe USD 10.000 virtuales y completa tu primera lección hoy. Sin tarjeta, sin
          depósitos y sin promesas de rentabilidad.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/crear-cuenta">
            <Button size="lg">Crear mi cuenta DEMO</Button>
          </Link>
          <Link href="/recursos">
            <Button size="lg" variant="outline">
              Explorar la academia
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
