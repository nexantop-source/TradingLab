import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getExplorerAssets } from '@/lib/market-explorer';
import { MarketExplorer } from '@/components/investment/MarketExplorer';
import { AdSlot } from '@/components/AdSlot';
export const metadata = { title: 'Explorar mercados' };
export default async function ExplorePage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');
  const [assets, saved] = await Promise.all([getExplorerAssets(), db.watchlistItem.findMany({ where: { userId: auth.user.id }, select: { symbol: true } })]);
  return <div className="invest-app-page"><header className="invest-page-heading"><span className="invest-eyebrow">TU UNIVERSO DE MERCADOS</span><h1>Encuentra tu próximo enfoque.</h1><p>ETFs, cripto, divisas y empresas. Explora, comprende y lleva tu idea al simulador.</p></header><MarketExplorer assets={assets} authenticated initialWatchlist={saved.map(s => s.symbol)} plan={auth.user.plan} /><div className="mt-10"><AdSlot code="public-banner" page="explorar" plan={auth.user.plan} /></div></div>;
}
