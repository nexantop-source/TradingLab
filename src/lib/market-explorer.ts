import 'server-only';
import { SYMBOLS, marketData } from '@tl/market-data';
import type { ExplorerAsset } from '@/components/investment/MarketExplorer';

/**
 * Instrumentos que se ofrecen en el explorador.
 *
 * Solo aparecen los que tienen precio real. Un instrumento que se lista y falla
 * al abrirlo es peor que uno que no se lista: la persona ya invirtió atención
 * en elegirlo, y lo que recibe es un error.
 *
 * El catálogo no se recorta -las simulaciones y listas de seguimiento ya
 * guardadas siguen resolviendo su instrumento-, pero lo que no tiene fuente
 * verdadera tampoco se ofrece como si la tuviera.
 */
export async function getExplorerAssets(): Promise<ExplorerAsset[]> {
  const provider = marketData();
  const at = Date.now();
  // Una sola llamada por lotes, no cincuenta y tres sueltas: el proveedor agrupa
  // cada instrumento con los de su misma fuente y pide veinte de golpe. Con una
  // petición por símbolo la página tardaba segundos y la fuente empezaba a
  // limitar la frecuencia, que es exactamente lo que dejaba la lista a medias.
  const quotes = await provider.getQuotes(SYMBOLS.map((s) => s.symbol), at);
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

  return SYMBOLS.filter((s) => {
    const quote = bySymbol.get(s.symbol);
    // Sin cotización no hay fuente; con cotización sintética hay motor
    // determinístico, que sirve para una lección pero no para el explorador.
    return quote != null && quote.provenance.synthetic === false;
  }).map((s) => {
    const quote = bySymbol.get(s.symbol)!;
    return {
      symbol: s.symbol,
      // Cuando la exposición se obtiene por un fondo cotizado, se enseña su
      // ticker: es el instrumento que de verdad se está mirando.
      ticker: s.displayTicker ?? s.symbol,
      popularity: s.popularity ?? 9999,
      name: s.name,
      assetClass: s.assetClass,
      precision: s.precision,
      currency: s.quoteCurrency,
      description: s.description,
      risk: s.educationalRisk,
      minPlan: s.minPlan,
      session: s.session.label,
      price: quote.price,
      change: quote.changePercent,
      synthetic: false,
      source: quote.provenance.providerLabel,
      marketStatus: quote.provenance.marketStatus,
      freshness: quote.provenance.freshness,
      timestamp: quote.provenance.sourceTimestamp,
    };
  });
}
