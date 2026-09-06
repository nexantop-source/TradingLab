import Link from 'next/link';
import { ArrowUpRight, CandlestickChart, Compass, WalletCards, BookOpen, ChevronRight, Flame } from 'lucide-react';
import { AssetIcon } from '@/components/investment/AssetIcon';
import type { AssetClass } from '@tl/types';

interface Props {
  name: string; balanceCents: number; dailyChange: number; streak: number;
  lesson: { slug: string; title: string; estimatedMinutes: number } | null;
  markets: Array<{ symbol: string; name: string; assetClass: AssetClass; precision: number; price: number; change: number }>;
}
export function NativeHome({ name, balanceCents, dailyChange, streak, lesson, markets }: Props) {
  return <section className="native-home" aria-label="Tu inicio en TradingLab">
    <div className="native-greeting"><div><p>Hola, {name.split(' ')[0]}</p><h1>Tu espacio.</h1></div><span><Flame size={16} aria-hidden="true" />{streak} {streak === 1 ? 'día' : 'días'}</span></div>
    <section className="native-balance" aria-label="Cuenta de práctica">
      <div><span>Cuenta de práctica</span><b>DEMO</b></div>
      <p className="native-balance-number"><small>USD</small> {(balanceCents / 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      <p className="native-balance-change">{dailyChange >= 0 ? '+' : '−'}USD {(Math.abs(dailyChange) / 100).toLocaleString('es-CO', { minimumFractionDigits: 2 })} <span>· resultado virtual de hoy</span></p>
      <div className="native-balance-foot"><span>Dinero virtual. No se puede retirar.</span><Link href="/portafolio" aria-label="Ver mi portafolio demo"><ArrowUpRight size={21} /></Link></div>
    </section>
    <div className="native-quick-actions">
      <Link href="/terminal"><span><CandlestickChart size={23} /></span>Practicar</Link>
      <Link href="/explorar"><span><Compass size={23} /></span>Explorar</Link>
      <Link href="/portafolio"><span><WalletCards size={23} /></span>Portafolio</Link>
    </div>
    <div className="native-section-heading"><h2>Tu próxima lección</h2><Link href="/academia">Ver academia <ChevronRight size={15} /></Link></div>
    <Link href={lesson ? `/academia/leccion/${lesson.slug}` : '/academia'} className="native-lesson-card">
      <span className="native-lesson-icon"><BookOpen size={24} /></span><span><small>UN PASO A LA VEZ</small><strong>{lesson?.title ?? 'Descubre por dónde empezar'}</strong><em>{lesson ? `${lesson.estimatedMinutes} min · A tu ritmo` : 'Explora las rutas de aprendizaje'}</em></span><ChevronRight size={20} />
    </Link>
    <div className="native-section-heading"><h2>Explora el mercado</h2><Link href="/explorar">Ver todos <ChevronRight size={15} /></Link></div>
    <div className="native-market-strip" aria-label="Referencias de mercado simuladas">{markets.map(m => <Link key={m.symbol} href={`/terminal?symbol=${encodeURIComponent(m.symbol)}`} className="native-market-card"><AssetIcon {...m} /><strong>{m.name}</strong><span>{m.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: m.precision })}</span><small className={m.change < 0 ? 'native-negative' : 'native-positive'}>{m.change >= 0 ? '+' : ''}{m.change.toFixed(2)}%</small></Link>)}</div>
    <p className="native-market-disclaimer">Precios de referencia DEMO · No son cotizaciones en vivo.</p>
    <div className="native-section-heading"><h2>Tu actividad</h2><Link href="/estadisticas">Ver progreso <ChevronRight size={15} /></Link></div>
  </section>;
}
