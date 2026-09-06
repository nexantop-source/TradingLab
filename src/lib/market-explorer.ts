import 'server-only';
import { SYMBOLS, marketData } from '@tl/market-data';
import type { ExplorerAsset } from '@/components/investment/MarketExplorer';

export async function getExplorerAssets(): Promise<ExplorerAsset[]> {
  const provider = marketData();
  const at = Date.now();
  const settled = await Promise.allSettled(SYMBOLS.map(s => provider.getQuote(s.symbol, at)));
  const quotes = settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  const bySymbol = new Map(quotes.map(q => [q.symbol, q]));
  return SYMBOLS.map(s => {
    const quote = bySymbol.get(s.symbol);
    return { symbol: s.symbol, name: s.name, assetClass: s.assetClass, precision: s.precision,
      currency: s.quoteCurrency, description: s.description, risk: s.educationalRisk, minPlan: s.minPlan,
      session: s.session.label, price: quote?.price ?? null, change: quote?.changePercent ?? null,
      synthetic: quote?.provenance.synthetic ?? provider.synthetic, source: quote?.provenance.providerLabel ?? 'Fuente no disponible',
      timestamp: quote?.provenance.sourceTimestamp ?? at,
    };
  });
}
