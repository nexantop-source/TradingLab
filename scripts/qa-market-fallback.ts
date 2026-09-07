/**
 * Simula que Yahoo Finance nos bloquea y comprueba qué sobrevive.
 *
 * Es el riesgo que quedaba abierto: Yahoo es una API no publicada y bloquea
 * rangos de centros de datos con cierta frecuencia. Desde aquí no se puede
 * probar la IP de producción, pero sí se puede probar lo único que importa de
 * verdad: **que el respaldo entre cuando la fuente principal cae**, y que lo
 * que no tiene respaldo falle en vez de inventarse un precio.
 *
 *   npx tsx scripts/qa-market-fallback.ts
 */
import { CompositeMarketDataProvider } from '../src/packages/market-data/composite-provider';
import { SYMBOLS } from '../src/packages/market-data/symbols';
import { resetYahooCache } from '../src/packages/market-data/yahoo-provider';

const real = globalThis.fetch;
let blocked = 0;

/** Deja pasar todo menos Yahoo, que responde como si nos hubiera bloqueado. */
function blockYahoo() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('finance.yahoo.com')) {
      blocked++;
      return new Response('Too Many Requests', { status: 429 });
    }
    return real(input as never, init);
  }) as typeof fetch;
}

function summarise(label: string, quotes: Array<{ symbol: string }>) {
  const byClass: Record<string, number> = {};
  for (const quote of quotes) {
    const meta = SYMBOLS.find((s) => s.symbol === quote.symbol);
    if (meta) byClass[meta.assetClass] = (byClass[meta.assetClass] ?? 0) + 1;
  }
  console.log(`${label}: ${quotes.length} de ${SYMBOLS.length}`, byClass);
}

async function main() {
  const provider = new CompositeMarketDataProvider();
  const all = SYMBOLS.map((s) => s.symbol);

  console.log('▸ Con todas las fuentes en pie');
  summarise('   cotizados', await provider.getQuotes(all));

  console.log('\n▸ Con Yahoo devolviendo 429 a todo');
  // Sin vaciar la caché el ensayo no prueba nada: la vuelta anterior dejó
  // dentro los precios buenos y se seguirían sirviendo sin tocar la red.
  resetYahooCache();
  blockYahoo();
  const degraded = new CompositeMarketDataProvider();
  const quotes = await degraded.getQuotes(all);
  summarise('   cotizados', quotes);

  console.log(`   peticiones a Yahoo interceptadas: ${blocked}`);
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  console.log('\n   Qué se salva y de dónde:');
  for (const symbol of ['AAPL', 'SPY', 'EURUSD', 'USDCOP', 'BTCUSD', 'SPX500', 'XAUUSD']) {
    const quote = bySymbol.get(symbol);
    console.log(
      `     ${symbol.padEnd(8)} ${quote ? `${quote.price.toFixed(4).padStart(12)}  ${quote.provenance.providerLabel} · ${quote.provenance.freshness}` : 'sin precio — se declara caído en vez de inventarlo'}`,
    );
  }

  // Lo que importa de verdad: que nada de lo que sale sea simulado.
  const invented = quotes.filter((q) => q.provenance.synthetic);
  console.log(
    `\n   Precios inventados entre los ${quotes.length} servidos: ${invented.length}` +
      (invented.length ? ` ← ${invented.map((q) => q.symbol).join(', ')}` : ' ✔'),
  );

  console.log('\n▸ El histórico no se rellena con la referencia diaria');
  try {
    await degraded.getCandles({ symbol: 'EURUSD', timeframe: '1d', limit: 30 });
    console.log('   ✖ devolvió velas: alguien está inventando una serie');
  } catch (error) {
    console.log('   ✔', error instanceof Error ? error.message : error);
  }

  globalThis.fetch = real;
}

main();
