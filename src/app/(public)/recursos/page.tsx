import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BookOpen, Clock3, ScrollText, ShieldCheck, Compass } from 'lucide-react';
import { TRACKS, trackStats } from '@/content/academy';
import { listNews } from '@tl/market-data';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
import { InvestmentArtwork } from '@/components/investment/InvestmentArtwork';

export const metadata: Metadata = {
  title: 'Aprender: rutas y recursos',
  description: 'Construye tu criterio con rutas educativas, artículos, glosario y práctica en una cuenta demo.',
};
const levels = { BASICO: 'Básico', INTERMEDIO: 'Intermedio', AVANZADO: 'Avanzado' };

export default function ResourcesPage() {
  const articles = listNews({ limit: 6 });
  const firstTrack = TRACKS[0];
  const firstStats = trackStats(firstTrack);
  const lessonCount = TRACKS.reduce((sum, track) => sum + trackStats(track).lessons, 0);
  const shortcuts = [
    { icon: BookOpen, title: 'Tu ruta, paso a paso', text: 'Del primer concepto a una estrategia propia.', href: '#rutas', label: 'Explorar las rutas' },
    { icon: ScrollText, title: 'Las palabras, claras', text: 'Un glosario para entender lo que estás leyendo.', href: '/glosario', label: 'Abrir el glosario' },
    { icon: Compass, title: 'De la teoría al mercado', text: 'Conoce los instrumentos que puedes practicar.', href: '/mercados', label: 'Explorar mercados' },
    { icon: ShieldCheck, title: 'Tu criterio te protege', text: 'Aprende a reconocer los fraudes financieros.', href: '/academia/prevencion-del-fraude', label: 'Conocer la ruta' },
  ];
  return <div className="learn-page">
    <header className="learn-hero invest-section">
      <div className="learn-hero-copy"><span className="invest-eyebrow">TRADINGLAB · APRENDER</span>
        <h1>El mejor activo<br />es tu <span>criterio.</span></h1>
        <p>Entiende antes de decidir. Descubre los mercados con lecciones claras, práctica en demo y espacio para hacer mejores preguntas.</p>
        <Link href="#rutas" className="invest-button">Encuentra tu primera ruta <ArrowRight size={17} /></Link>
        <div className="learn-hero-stats"><span><strong>{TRACKS.length}</strong> rutas educativas</span><span><strong>{lessonCount}</strong> lecciones para explorar</span></div>
      </div>
      <div className="learn-hero-art"><InvestmentArtwork scene="learning" priority sizes="(max-width: 760px) 100vw, 50vw" /><span className="learn-art-caption"><BookOpen size={16} />Aprende. Practica. Vuelve con más preguntas.</span></div>
    </header>
    <nav className="invest-section learn-shortcuts" aria-label="Recursos para aprender">{shortcuts.map(s => <Link href={s.href} key={s.href}><s.icon size={24} strokeWidth={1.5} aria-hidden="true" /><h2>{s.title}</h2><p>{s.text}</p><span>{s.label}<ArrowUpRight size={16} /></span></Link>)}</nav>
    <section className="invest-section learn-curriculum" id="rutas">
      <div className="learn-section-heading"><div><span className="invest-eyebrow">UN CONCEPTO A LA VEZ</span><h2>Tu punto de partida.<br /><span>Tu siguiente perspectiva.</span></h2></div><p>Elige por curiosidad o por nivel. Las rutas se abren en tu cuenta; el acceso a sus lecciones depende de tu plan.</p></div>
      <Link href={`/academia/${firstTrack.slug}`} className="learn-featured-track"><div className="learn-featured-number" aria-hidden="true">01<span>EL COMIENZO</span></div><div><span className="invest-eyebrow">RECOMENDADO PARA EMPEZAR · EXPLORE GRATIS</span><h3>{firstTrack.title}</h3><p>{firstTrack.summary}</p><span className="learn-track-meta"><BookOpen size={15} />{firstStats.lessons} lecciones <Clock3 size={15} />{firstStats.minutes} min</span></div><span className="learn-featured-arrow"><ArrowUpRight size={24} /><span>Empezar aquí</span></span></Link>
      <div className="learn-track-grid">{TRACKS.slice(1).map((track, index) => {
        const stats = trackStats(track);
        return <Link className={`learn-track level-${track.level.toLowerCase()}`} href={`/academia/${track.slug}`} key={track.slug}><div className="learn-track-top"><span className="learn-level">{levels[track.level]}</span><span className="learn-track-number">{String(index + 2).padStart(2, '0')}</span></div><h3>{track.title}</h3><p>{track.summary}</p><div className="learn-track-meta"><span>{stats.lessons} lecciones · {stats.minutes} min</span><ArrowUpRight size={17} /></div><small>Desde {PLAN_ENTITLEMENTS[track.minPlan].name}{track.minPlan === 'FREE' ? ' · gratis' : ''}</small></Link>;
      })}</div>
    </section>
    <section className="learn-reading" id="articulos"><div className="invest-section"><div className="learn-section-heading"><div><span className="invest-eyebrow">UNA PAUSA CON PERSPECTIVA</span><h2>Ideas que vale<br />la pena entender.</h2></div><p>Lecturas breves para poner los conceptos en contexto. Los artículos completos se leen dentro de tu cuenta.</p></div><div className="learn-article-grid">{articles.map((article, index) => <Link href={`/noticias/${article.slug}`} key={article.id} className="learn-article"><div className={`learn-article-cover cover-${index % 3}`}><span>{article.tags[0] ?? 'EDUCACIÓN'}</span><BookOpen size={40} strokeWidth={1} aria-hidden="true" /><span>{String(index + 1).padStart(2, '0')}</span></div><div className="learn-article-copy"><small><Clock3 size={13} />{article.readingMinutes} min de lectura</small><h3>{article.title}</h3><p>{article.summary}</p><span className="invest-text-link">Leer en TradingLab <ArrowUpRight size={15} /></span></div></Link>)}</div></div></section>
    <section className="invest-section learn-next"><BookOpen size={30} strokeWidth={1.5} /><h2>Lo que entiendes hoy,<br />lo puedes practicar mañana.</h2><p>Empieza con una cuenta gratuita y USD 10.000 virtuales.</p><Link href="/crear-cuenta" className="invest-button">Crear mi espacio <ArrowRight size={17} /></Link></section>
  </div>;
}
