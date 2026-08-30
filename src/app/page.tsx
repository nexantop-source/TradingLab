import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  CircleX,
  Clock3,
  Gauge,
  LineChart,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { Logo } from '@/components/Logo';
import { Reveal, Stagger } from '@/components/motion/Motion';
import { Button } from '@tl/ui';
import { getAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const WITHOUT_EDUCATION = [
  'Entrar porque el precio se está moviendo',
  'Arriesgar sin saber cuánto puedes perder',
  'Confundir una buena racha con una estrategia',
  'Repetir errores que nunca documentaste',
];

const WITH_TRADINGLAB = [
  'Construir una hipótesis antes de actuar',
  'Definir riesgo, entrada y salida con intención',
  'Practicar con capital 100 % virtual',
  'Revisar cada decisión y medir tu progreso',
];

export default async function LandingPage() {
  const auth = await getAuth();

  return (
    <div className="marketing-page apple-landing">
      <MarketingHeader authenticated={Boolean(auth)} />

      <main id="contenido">
        <section className="apple-hero" aria-labelledby="hero-title">
          <div className="apple-hero-glow" aria-hidden="true" />
          <div className="apple-shell apple-hero-inner">
            <Reveal className="apple-hero-copy" y={16}>
              <div className="apple-pill">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Educación de mercados, llevada a la práctica
              </div>
              <h1 id="hero-title">
                Aprende a decidir.
                <span> Antes de arriesgar.</span>
              </h1>
              <p>
                Formación, simulación y retroalimentación en un solo lugar. Entiende qué haces,
                por qué lo haces y cómo mejorar —sin poner dinero real en juego.
              </p>
              <div className="apple-hero-actions">
                <Link href={auth ? '/panel' : '/crear-cuenta'}>
                  <Button size="lg" className="apple-primary-button">
                    {auth ? 'Ir a mi panel' : 'Empezar gratis'}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </Link>
                <Link href="#producto" className="apple-text-link">
                  Descubrir TradingLab
                  <span aria-hidden="true">↓</span>
                </Link>
              </div>
              <p className="apple-hero-note">
                <ShieldCheck className="size-4" aria-hidden="true" />
                USD 10.000 virtuales · Sin tarjeta · Sin depósitos
              </p>
            </Reveal>

            <Reveal className="apple-product-stage" delay={0.14} y={28}>
              <ProductPreview />
            </Reveal>
          </div>
        </section>

        <section id="producto" className="apple-section apple-bento-section" aria-labelledby="product-title">
          <div className="apple-shell">
            <Reveal className="apple-section-heading">
              <span>Todo conectado</span>
              <h2 id="product-title">No necesitas más información. Necesitas un método.</h2>
              <p>Aprender, practicar y revisar dejan de ser actividades separadas.</p>
            </Reveal>

            <Stagger className="apple-bento-grid" stagger={0.09}>
              <article className="apple-bento-card apple-bento-academy">
                <div className="apple-card-copy">
                  <div className="apple-card-icon apple-icon-blue">
                    <BookOpen aria-hidden="true" />
                  </div>
                  <p className="apple-card-kicker">Academia guiada</p>
                  <h3>Primero entiendes. Luego practicas.</h3>
                  <p>Rutas breves y progresivas, construidas alrededor de decisiones reales.</p>
                </div>
                <div className="academy-stack" aria-label="Progreso de una ruta educativa">
                  <div className="academy-progress-head">
                    <span>Gestión del riesgo</span>
                    <strong>72 %</strong>
                  </div>
                  <div className="academy-progress"><i /></div>
                  <div className="academy-lessons">
                    <span><Check aria-hidden="true" /> Riesgo por operación</span>
                    <span><Check aria-hidden="true" /> Relación riesgo/beneficio</span>
                    <span className="is-current"><Clock3 aria-hidden="true" /> Tamaño de posición</span>
                  </div>
                </div>
              </article>

              <article className="apple-bento-card apple-bento-coach">
                <div className="apple-card-copy">
                  <div className="apple-card-icon apple-icon-violet">
                    <Brain aria-hidden="true" />
                  </div>
                  <p className="apple-card-kicker">Entrenador IA</p>
                  <h3>Preguntas que mejoran tu criterio.</h3>
                  <p>No te dice qué comprar. Te ayuda a pensar mejor.</p>
                </div>
                <div className="coach-conversation" aria-label="Ejemplo de retroalimentación educativa">
                  <div className="coach-question">¿Qué invalidaría tu hipótesis?</div>
                  <div className="coach-answer">
                    <Sparkles aria-hidden="true" />
                    Define ese nivel antes de abrir la simulación.
                  </div>
                </div>
              </article>

              <article className="apple-bento-card apple-bento-simulator">
                <div className="simulator-orbit" aria-hidden="true" />
                <div className="apple-card-copy">
                  <div className="apple-card-icon apple-icon-light">
                    <WalletCards aria-hidden="true" />
                  </div>
                  <p className="apple-card-kicker">Simulación realista</p>
                  <h3>Equivócate sin pagar el precio.</h3>
                  <p>USD 10.000 virtuales para convertir conceptos en experiencia.</p>
                </div>
                <div className="simulator-balance">
                  <span>Capital virtual</span>
                  <strong>USD 10.000</strong>
                  <small>Sin depósitos. Sin ejecución real.</small>
                </div>
              </article>

              <article className="apple-bento-card apple-bento-journal">
                <div className="apple-card-copy">
                  <div className="apple-card-icon apple-icon-green">
                    <NotebookPen aria-hidden="true" />
                  </div>
                  <p className="apple-card-kicker">Diario y métricas</p>
                  <h3>Lo que mides, mejora.</h3>
                  <p>Detecta patrones en tus decisiones, no solo en el gráfico.</p>
                </div>
                <div className="journal-insight">
                  <div>
                    <span>Disciplina</span>
                    <strong>8.4<small>/10</small></strong>
                  </div>
                  <div className="journal-bars" aria-hidden="true">
                    {[42, 58, 52, 71, 68, 86, 82].map((height, index) => (
                      <i key={height + index} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                  <p><TrendingUp aria-hidden="true" /> Mejoraste 18 % este mes</p>
                </div>
              </article>
            </Stagger>
          </div>
        </section>

        <section id="metodo" className="apple-section apple-compare-section" aria-labelledby="compare-title">
          <div className="apple-shell">
            <Reveal className="apple-section-heading apple-section-heading-centered">
              <span>La diferencia es el proceso</span>
              <h2 id="compare-title">La intuición improvisa. El método aprende.</h2>
            </Reveal>

            <Stagger className="apple-compare-grid" stagger={0.12}>
              <article className="apple-compare-card apple-compare-without">
                <div className="apple-compare-topline">
                  <CircleX aria-hidden="true" />
                  <span>Empezar sin educación</span>
                </div>
                <h3>Reaccionas al mercado.</h3>
                <ul>
                  {WITHOUT_EDUCATION.map((item) => (
                    <li key={item}><span aria-hidden="true">—</span>{item}</li>
                  ))}
                </ul>
                <div className="impulse-meter" aria-label="Proceso reactivo e inconsistente">
                  <span>Impulso</span><i /><span>Decisión</span><i /><span>Duda</span>
                </div>
              </article>

              <article className="apple-compare-card apple-compare-with">
                <div className="apple-compare-topline">
                  <Target aria-hidden="true" />
                  <span>Aprender con TradingLab</span>
                </div>
                <h3>Construyes criterio.</h3>
                <ul>
                  {WITH_TRADINGLAB.map((item) => (
                    <li key={item}><Check aria-hidden="true" />{item}</li>
                  ))}
                </ul>
                <div className="method-loop" aria-label="Ciclo de aprendizaje estructurado">
                  <span>Aprende</span><ArrowRight aria-hidden="true" /><span>Practica</span>
                  <ArrowRight aria-hidden="true" /><span>Revisa</span>
                </div>
              </article>
            </Stagger>
          </div>
        </section>

        <section className="apple-final-section" aria-labelledby="final-title">
          <div className="apple-shell">
            <Reveal className="apple-final-card">
              <div className="apple-final-orb" aria-hidden="true" />
              <div>
                <span className="apple-final-kicker">Tu primera decisión inteligente</span>
                <h2 id="final-title">Aprender antes de arriesgar.</h2>
                <p>Empieza gratis con capital virtual. Mejora a tu ritmo.</p>
              </div>
              <div className="apple-final-actions">
                <Link href={auth ? '/panel' : '/crear-cuenta'}>
                  <Button size="lg" className="apple-final-button">
                    {auth ? 'Continuar aprendiendo' : 'Crear mi cuenta gratis'}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </Link>
                <Link href="/precios">Ver planes</Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="product-preview">
      <div className="product-preview-bar">
        <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
        <span>TradingLab · Sesión de práctica</span>
        <div className="preview-status"><i /> Simulación</div>
      </div>

      <div className="product-preview-body">
        <aside className="preview-sidebar" aria-label="Navegación de ejemplo">
          <Logo size="sm" withWordmark={false} />
          <i className="is-active"><Gauge /></i>
          <i><LineChart /></i>
          <i><BookOpen /></i>
          <i><NotebookPen /></i>
        </aside>

        <div className="preview-workspace">
          <div className="preview-overview">
            <div>
              <span>Buenos días, Laura</span>
              <strong>Entrena una decisión a la vez.</strong>
            </div>
            <div className="preview-balance">
              <span>Capital virtual</span>
              <strong>USD 10.000,00</strong>
            </div>
          </div>

          <div className="preview-grid">
            <div className="preview-chart-card">
              <div className="preview-card-head">
                <div><strong>EUR / USD</strong><span>Práctica guiada · 1H</span></div>
                <span className="preview-positive">+0,42 %</span>
              </div>
              <div className="preview-chart" aria-label="Gráfico educativo de ejemplo">
                <div className="chart-grid" aria-hidden="true" />
                <svg viewBox="0 0 720 230" preserveAspectRatio="none" role="img" aria-label="Evolución ascendente de una serie de práctica">
                  <defs>
                    <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#0a84ff" stopOpacity="0.28" />
                      <stop offset="1" stopColor="#0a84ff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path className="preview-chart-area" d="M0 195 C65 178, 82 190, 132 158 S210 176, 266 128 S345 142, 398 104 S470 128, 525 79 S612 100, 720 34 L720 230 L0 230 Z" />
                  <path className="preview-chart-line" d="M0 195 C65 178, 82 190, 132 158 S210 176, 266 128 S345 142, 398 104 S470 128, 525 79 S612 100, 720 34" />
                </svg>
                <div className="chart-marker"><i /><span>Tu hipótesis</span></div>
              </div>
            </div>

            <div className="preview-coach-card">
              <div className="preview-coach-icon"><Brain aria-hidden="true" /></div>
              <span>Entrenador IA</span>
              <strong>Antes de continuar…</strong>
              <p>¿Qué nivel demostraría que tu hipótesis es incorrecta?</p>
              <div className="preview-coach-action"><Sparkles aria-hidden="true" /> Formular mi respuesta</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingFooter() {
  return (
    <footer className="apple-footer">
      <div className="apple-shell apple-footer-inner">
        <Logo size="sm" />
        <p>Plataforma educativa y de simulación. No permite operar con dinero real.</p>
        <nav aria-label="Enlaces legales">
          <Link href="/legal/riesgo">Riesgo</Link>
          <Link href="/legal/privacidad">Privacidad</Link>
          <Link href="/contacto">Contacto</Link>
        </nav>
      </div>
    </footer>
  );
}
