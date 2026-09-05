import { getExplorerAssets } from '@/lib/market-explorer';
import { MarketExplorer } from '@/components/investment/MarketExplorer';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { AdSlot } from '@/components/AdSlot';
export const metadata = { title: 'ETFs, cripto y divisas', description: 'Explora el catálogo multiactivo de TradingLab. Busca ETFs, divisas, criptomonedas y acciones para practicar.' };
export default async function MarketsPage() {
  const [assets, auth] = await Promise.all([getExplorerAssets(), getAuth()]);
  const saved = auth ? await db.watchlistItem.findMany({ where: { userId: auth.user.id }, select: { symbol: true } }) : [];
  return <div className="invest-section"><header className="invest-page-heading"><span className="invest-eyebrow">UN MUNDO DE POSIBILIDADES</span><h1>Los mercados.<br /><span>A tu alcance.</span></h1><p>Explora {assets.length} instrumentos en seis mercados. Guarda lo que te interesa y entiende lo que hay detrás de cada símbolo.</p></header><MarketExplorer assets={assets} authenticated={Boolean(auth)} initialWatchlist={saved.map(s => s.symbol)} plan={auth?.user.plan} /><div className="mt-10"><AdSlot code="public-banner" page="mercados" plan={auth?.user.plan ?? 'FREE'} /></div></div>;
}
