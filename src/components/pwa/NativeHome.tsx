import Link from 'next/link';
import { ArrowUpRight, ArrowRight, CandlestickChart, WalletCards, ChevronRight, Flame, Check, NotebookPen } from 'lucide-react';
import { AssetIcon } from '@/components/investment/AssetIcon';
import { LearningSculpture } from './LearningSculpture';
import { AppOrientation } from './AppOrientation';
import type { AssetClass, PlanId } from '@tl/types';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';

interface Props {
  name: string; balanceCents: number; dailyChange: number; streak: number; plan: PlanId;
  completedLessons: number; totalLessons: number; level: number; xp: number; openPositions: number;
  lesson: { slug: string; title: string; estimatedMinutes: number } | null;
  markets: Array<{ symbol: string; name: string; assetClass: AssetClass; precision: number; price: number; change: number }>;
}
export function NativeHome({ name, balanceCents, dailyChange, streak, plan, completedLessons, totalLessons, level, xp, openPositions, lesson, markets }: Props) {
  const progress = totalLessons ? Math.min(100, completedLessons / totalLessons * 100) : 0;
  return <section className="native-home native-home-v2" aria-label="Tu inicio en TradingLab">
    <header className="native-home-greeting"><div><p>Hola, {name.split(' ')[0]}</p><h1>Un paso<br /><span>más claro.</span></h1></div><Link href="/perfil" aria-label="Abrir mi cuenta" className="native-home-avatar">{name.trim().slice(0, 1).toUpperCase()}</Link></header>
    <section className="native-focus" aria-labelledby="native-focus-title">
      <div className="native-focus-art"><LearningSculpture /></div>
      <div className="native-focus-content"><span className="native-kicker">TU PRÓXIMO PASO</span><h2 id="native-focus-title">{lesson?.title ?? 'Todo empieza por entender.'}</h2><p>{lesson ? `${lesson.estimatedMinutes} min · Aprende a tu ritmo` : 'Descubre tu ruta en la academia'}</p><Link href={lesson ? `/academia/leccion/${lesson.slug}` : '/academia'}>{lesson ? 'Continuar lección' : 'Abrir academia'}<ArrowUpRight size={20} aria-hidden="true" /></Link></div>
    </section>
    <div className="native-section-heading"><h2>Tu laboratorio</h2><span className="native-demo-tag">DEMO</span></div>
    <section className="native-demo-wallet" aria-label="Cuenta de práctica">
      <div className="native-demo-wallet-top"><div><p>Saldo para practicar</p><strong><small>USD</small> {(balanceCents / 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div><WalletCards size={24} aria-hidden="true" /></div>
      <p className="native-demo-change">{dailyChange >= 0 ? '+' : '−'}USD {(Math.abs(dailyChange) / 100).toLocaleString('es-CO', { minimumFractionDigits: 2 })} <span>· resultado virtual de hoy</span></p>
      <div className="native-wallet-actions"><Link href="/terminal"><CandlestickChart size={18} aria-hidden="true" />Practicar</Link><Link href="/portafolio">Mi portafolio<ArrowUpRight size={17} aria-hidden="true" /></Link></div>
      <p className="native-wallet-disclaimer">Dinero virtual. No es un depósito y no se puede retirar.</p>
    </section>
    <div className="native-section-heading"><h2>Lo que construyes</h2><span className="native-streak"><Flame size={15} aria-hidden="true" />{streak} {streak === 1 ? 'día' : 'días'}</span></div>
    <Link href="/estadisticas" className="native-learning-progress">
      <div className="native-level-medal" aria-hidden="true"><span>NIVEL</span><b>{level}</b></div>
      <div className="native-progress-copy"><strong>Nivel {level} · {xp.toLocaleString('es-CO')} XP</strong><span>{completedLessons} de {totalLessons} lecciones completadas</span><div role="progressbar" aria-label="Lecciones completadas" aria-valuenow={completedLessons} aria-valuemin={0} aria-valuemax={Math.max(totalLessons, completedLessons, 1)} className="native-progress-track"><i style={{ width: `${progress}%` }} /></div></div><ChevronRight size={18} aria-hidden="true" />
    </Link>
    <div className="native-section-heading"><h2>Mercados para explorar</h2><Link href="/explorar" aria-label="Ver todos los mercados">Ver todos<ChevronRight size={15} /></Link></div>
    <div className="native-market-strip" aria-label="Referencias de mercado simuladas">{markets.map(m => <Link key={m.symbol} href={`/terminal?symbol=${encodeURIComponent(m.symbol)}`} className="native-market-card"><AssetIcon {...m} /><strong>{m.name}</strong><span>{m.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: m.precision })}</span><small className={m.change < 0 ? 'native-negative' : 'native-positive'}>{m.change >= 0 ? '+' : ''}{m.change.toFixed(2)}%</small></Link>)}</div>
    <p className="native-market-disclaimer">Precios de referencia DEMO · No son cotizaciones en vivo.</p>
    <div className="native-section-heading"><h2>Tus decisiones, en contexto</h2></div>
    <nav className="native-activity-list" aria-label="Tu actividad de práctica"><Link href="/portafolio"><CandlestickChart size={20} aria-hidden="true" /><span><strong>Simulaciones abiertas</strong><small>{openPositions ? `${openPositions} en curso · Revisa tu exposición virtual` : 'Sin operaciones en curso. Ve a tu ritmo.'}</small></span><b>{openPositions}</b><ChevronRight size={17} /></Link><Link href="/diario"><NotebookPen size={20} aria-hidden="true" /><span><strong>Tu diario de decisiones</strong><small>Observa qué aprendiste, no solo el resultado.</small></span><ChevronRight size={17} /></Link></nav>
    <div className="native-home-membership"><span><Check size={16} aria-hidden="true" /><strong>{PLAN_ENTITLEMENTS[plan].name} {plan === 'FREE' ? 'incluido' : 'activo'}</strong></span><p>{plan === 'FREE' ? 'Tu espacio gratuito está activo. No necesitas elegirlo ni añadir una tarjeta.' : 'Consulta tu periodo de acceso y las herramientas de tu plan.'}</p><Link href={plan === 'FREE' ? '/precios' : '/perfil'}>{plan === 'FREE' ? 'Conocer Plus y Pro' : 'Ver mi cuenta'}<ArrowRight size={15} aria-hidden="true" /></Link></div>
    <AppOrientation />
  </section>;
}
