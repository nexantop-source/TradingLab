import Link from 'next/link';
import { ArrowUpRight, CandlestickChart, WalletCards, ChevronRight } from 'lucide-react';
import { AppOrientation } from './AppOrientation';
import { HomeNews } from './HomeNews';
import type { AssetClass, PlanId } from '@tl/types';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
interface Props {
  name:string; balanceCents:number; dailyChange:number; streak:number; plan:PlanId;
  completedLessons:number; totalLessons:number; level:number; xp:number; openPositions:number;
  lesson:{ slug:string; title:string; estimatedMinutes:number } | null;
  markets:Array<{ symbol:string; name:string; assetClass:AssetClass; precision:number; price:number; change:number }>;
}
export function NativeHome({name,balanceCents,dailyChange,plan,openPositions,lesson}:Props) {
  return <section className="native-home native-home-v2 native-home-v3" aria-label="Tu inicio en TradingLab">
    <header className="native-home-greeting"><div><p>Hola, {name.split(' ')[0]}</p><h1>Tu espacio.<br/><span>Tu siguiente idea.</span></h1></div><Link href="/billing" className="native-home-avatar" aria-label="Abrir mi facturación"><WalletCards size={22}/></Link></header>
    <div className="native-home-membership"><span><strong>{PLAN_ENTITLEMENTS[plan].name} {plan==='FREE'?'incluido':'activo'}</strong></span><Link href={plan==='FREE'?'/precios':'/billing'}>{plan==='FREE'?'Mejorar mi plan':'Gestionar mi plan'}<ArrowUpRight size={16}/></Link></div>
    <section className="native-demo-wallet" aria-label="Cuenta de práctica"><div className="native-demo-wallet-top"><div><p>Saldo virtual disponible</p><strong><small>USD</small> {(balanceCents/100).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div><WalletCards size={24}/></div>
    <p className="native-demo-change">{dailyChange>=0?'+':'−'}USD {(Math.abs(dailyChange)/100).toLocaleString('es-CO',{minimumFractionDigits:2})}<span> · resultado demo de hoy</span></p>
    <div className="native-wallet-actions"><Link href="/terminal"><CandlestickChart size={18}/>Operar demo</Link><Link href="/portafolio">Posiciones · {openPositions}<ArrowUpRight size={17}/></Link></div><p className="native-wallet-disclaimer">Dinero virtual. No es un depósito ni se puede retirar.</p></section>
    <HomeNews free={plan==='FREE'}/>
    <div className="native-section-heading"><h2>Sigue aprendiendo</h2><Link href="/academia">Academia<ChevronRight size={15}/></Link></div>
    <Link className="native-learning-progress" href={lesson?`/academia/leccion/${lesson.slug}`:'/academia'}><div className="native-progress-copy"><strong>{lesson?.title??'El primer paso es entender.'}</strong><span>{lesson?`${lesson.estimatedMinutes} min · Retoma a tu ritmo`:'Explora tu ruta de aprendizaje'}</span></div><ChevronRight size={18}/></Link>
    <AppOrientation/>
  </section>;
}
