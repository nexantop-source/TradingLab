import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, WalletCards } from 'lucide-react';
import { getAuth } from '@/lib/auth';
import { ensureDemoAccount } from '@/lib/demo-account';
import { listOpenPositions, settleDueSimulations } from '@/lib/simulation-service';
import { db } from '@/lib/db';
import { getSymbol } from '@tl/market-data';
import { ASSET_CLASS_LABEL, type AssetClass } from '@tl/types';
import { AssetIcon } from '@/components/investment/MarketExplorer';
export const metadata = { title: 'Tu portafolio demo' };
const usd = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export default async function PortfolioPage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');
  await settleDueSimulations(auth.user.id);
  const [account, positions, closed] = await Promise.all([ensureDemoAccount(auth.user.id), listOpenPositions(auth.user.id, { all: true }), db.simulation.findMany({ where: { userId: auth.user.id, status: 'CLOSED' }, orderBy: { closedAt: 'desc' }, take: 8 })]);
  const reserved = positions.reduce((n, p) => n + p.stakeCents, 0);
  const pnl = positions.reduce((n, p) => n + p.unrealizedPnlCents, 0);
  const allocation = positions.reduce<Partial<Record<AssetClass, number>>>((a, p) => { const c = getSymbol(p.symbol)?.assetClass; if (c) a[c] = (a[c] ?? 0) + p.stakeCents; return a; }, {});
  return <div className="invest-app-page"><header className="invest-page-heading"><span className="invest-eyebrow">UNA VISIÓN COMPLETA · DEMO</span><h1>Tu portafolio, en perspectiva.</h1><p>Conoce cómo distribuyes tu saldo virtual y qué hay detrás de cada posición.</p></header>
    <div className="invest-portfolio-summary"><div><span>Saldo disponible · DEMO</span><strong>{usd(account.balanceCents)}</strong><small>USD virtuales</small></div><div><span>Capital reservado</span><strong>{usd(reserved)}</strong><small>En {positions.length} posiciones abiertas</small></div><div><span>Resultado no realizado</span><strong className={pnl < 0 ? 'down' : 'invest-positive'}>{pnl > 0 ? '+' : ''}{usd(pnl)}</strong><small>Estimación DEMO al consultar</small></div></div>
    <div className="invest-portfolio-grid"><section className="invest-panel"><div className="invest-panel-heading"><h2>Posiciones abiertas</h2><Link href="/terminal">Abrir trading <ArrowRight size={15} /></Link></div>{positions.length ? positions.map(p => <Link className="invest-position" href={`/terminal?symbol=${p.symbol}`} key={p.id}><AssetIcon symbol={p.symbol} assetClass={getSymbol(p.symbol)?.assetClass ?? 'STOCK'} /><div><strong>{p.symbol}</strong><small>{p.direction === 'BEARISH' ? 'Venta' : 'Compra'} · {p.mode}</small></div><div><strong>{usd(p.stakeCents)}</strong><small>Capital reservado</small></div><span className={p.unrealizedPnlCents < 0 ? 'down' : 'invest-positive'}>{usd(p.unrealizedPnlCents)}</span></Link>) : <div className="invest-empty"><WalletCards size={32} /><h3>Un espacio para tus primeras ideas.</h3><p>Explora un instrumento y abre una posición demo para empezar a construir tu portafolio.</p><Link className="invest-button" href="/explorar">Explorar mercados <ArrowRight size={15} /></Link></div>}</section><section className="invest-panel"><div className="invest-panel-heading"><h2>Distribución</h2><span>Capital reservado</span></div>{Object.entries(allocation).length ? Object.entries(allocation).map(([category, value]) => <div className="invest-allocation" key={category}><div><span>{ASSET_CLASS_LABEL[category as AssetClass]}</span><strong>{((value / reserved) * 100).toFixed(1)}%</strong></div><meter min={0} max={reserved} value={value} aria-label={`Capital en ${ASSET_CLASS_LABEL[category as AssetClass]}`} /></div>) : <div className="invest-empty"><LayersIllustration /><p>La distribución aparecerá cuando abras tu primera posición.</p></div>}<p className="invest-detail-note">Distribución de margen virtual reservado; no representa propiedad de activos ni exposición nocional.</p></section></div>
    <section className="invest-panel"><div className="invest-panel-heading"><h2>Actividad reciente</h2><Link href="/diario">Revisar en el diario <ArrowRight size={15} /></Link></div>{closed.length ? closed.map(p=><div className="invest-position" key={p.id}><AssetIcon symbol={p.symbol} assetClass={getSymbol(p.symbol)?.assetClass ?? 'STOCK'} /><div><strong>{p.symbol}</strong><small>{p.closedAt?.toISOString().slice(0,10)} · Cerrada</small></div><span className={(p.pnlCents ?? 0) < 0 ? 'down' : 'invest-positive'}>{usd(p.pnlCents ?? 0)}</span></div>) : <p className="invest-empty">Tus operaciones cerradas aparecerán aquí.</p>}</section>
  </div>;
}
function LayersIllustration() { return <div className="invest-allocation-empty" aria-hidden="true"><span /><span /><span /></div>; }
