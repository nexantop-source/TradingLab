/** Read-only production audit of every configured instrument. No accounts or orders. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SYMBOLS } from '../src/packages/market-data/symbols';
import type { Quote } from '../src/packages/types';

async function main() {
  const base = process.env.MARKET_AUDIT_BASE ?? 'https://tradinglab--nexant-87204.us-east4.hosted.app';
  const output = resolve('docs/colombia/market-audit.json');
  const startedAt = new Date().toISOString();
  const rows: Array<Record<string, unknown>> = [];
  for (let offset = 0; offset < SYMBOLS.length; offset += 30) {
    const group = SYMBOLS.slice(offset, offset + 30);
    let quotes: Quote[] = [];
    let failure: string | null = null;
    try {
      const response = await fetch(`${base}/api/market/quotes?symbols=${group.map(s => encodeURIComponent(s.symbol)).join(',')}`, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (!Array.isArray(body.data?.quotes)) throw new Error('Invalid quote response');
      quotes = body.data.quotes;
    } catch (error) { failure = error instanceof Error ? error.message : 'Unknown response'; }
    const observedAt = Date.now();
    const bySymbol = new Map(quotes.map(q => [q.symbol, q]));
    for (const symbol of group) {
      const q = bySymbol.get(symbol.symbol);
      const p = q?.provenance;
      const ageSeconds = p ? Math.max(0, Math.round((observedAt - p.sourceTimestamp) / 1000)) : null;
      const status = failure ? 'AUDIT_REQUEST_FAILED' : !q || !p ? 'UNAVAILABLE' : p.synthetic ? 'SYNTHETIC' : p.marketStatus === 'CLOSED' ? 'CLOSED_REFERENCE' : p.freshness === 'REALTIME' && ageSeconds !== null && ageSeconds <= 30 ? 'RECENT_REALTIME_SAMPLE' : 'DELAYED_OR_STALE';
      rows.push({ symbol: symbol.symbol, name: symbol.name, assetClass: symbol.assetClass, yahooSymbol: symbol.yahooSymbol ?? null, status, observedAt: new Date(observedAt).toISOString(), price: q?.price ?? null, ageSeconds, provenance: p ?? null, error: q ? null : failure ?? 'No quote returned by production' });
    }
    console.log(`Audited ${Math.min(offset + 30, SYMBOLS.length)}/${SYMBOLS.length}`);
  }
  const counts: Record<string, number> = {};
  const byClass: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const status = String(row.status), family = String(row.assetClass);
    counts[status] = (counts[status] ?? 0) + 1;
    byClass[family] ??= {};
    byClass[family][status] = (byClass[family][status] ?? 0) + 1;
  }
  await mkdir(resolve('docs/colombia'), { recursive: true });
  const report = { startedAt, finishedAt: new Date().toISOString(), base, scope: 'All symbols in the local catalog queried anonymously against production; point-in-time evidence, not an SLA or verification of redistribution rights. Closed markets require an open-session recheck.', total: rows.length, counts, byClass, rows };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, total: rows.length, counts, byClass }, null, 2));
  if (counts.AUDIT_REQUEST_FAILED) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
