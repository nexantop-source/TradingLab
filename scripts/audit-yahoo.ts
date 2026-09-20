/** Public, read-only audit of the configured Yahoo source. No accounts or trades. */
import { writeFile } from 'node:fs/promises';
import { YahooMarketDataProvider } from '../src/packages/market-data/yahoo-provider';
import { SYMBOLS } from '../src/packages/market-data/symbols';

async function main() {
  const provider = new YahooMarketDataProvider();
  const startedAt = new Date().toISOString();
  const rows: unknown[] = [];
  for (let offset = 0; offset < SYMBOLS.length; offset += 20) {
    const symbols = SYMBOLS.slice(offset, offset + 20);
    const quotes = await provider.getQuotes(symbols.map(s => s.symbol));
    for (const symbol of symbols) {
      const quote = quotes.find(q => q.symbol === symbol.symbol);
      rows.push({ symbol: symbol.symbol, status: quote ? 'REAL_QUOTE' : 'UNAVAILABLE', price: quote?.price ?? null, provenance: quote?.provenance ?? null });
    }
    console.log(`Yahoo: ${Math.min(offset + 20, SYMBOLS.length)}/${SYMBOLS.length}`);
  }
  const charts = [];
  for (const symbol of ['BTCUSD', 'AAPL', 'EURUSD', 'SPX500', 'XAUUSD']) {
    try {
      const series = await provider.getCandles({ symbol, timeframe: '5m', limit: 100 });
      charts.push({ symbol, points: series.candles.length, first: series.candles[0], last: series.candles.at(-1), provenance: series.provenance });
    } catch (error) { charts.push({ symbol, error: error instanceof Error ? error.message : String(error) }); }
  }
  const report = { startedAt, finishedAt: new Date().toISOString(), source: provider.id, scope: 'Local Yahoo adapter querying public upstream; point-in-time availability only, not proof of live production deployment or a real-time SLA.', rows, charts };
  await writeFile('docs/colombia/yahoo-audit.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(charts, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
