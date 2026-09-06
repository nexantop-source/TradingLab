/** Read-only public market probe. No credentials, accounts, orders or payments. */
import assert from 'node:assert/strict';
import { BinanceMarketDataProvider, LIVE_PAIRS } from '../src/packages/market-data/binance-provider';
import { buildMarketPulse } from '../src/packages/market-data/pulse';
async function main() {
  const provider = new BinanceMarketDataProvider();
  const results = [];
  for (const symbol of LIVE_PAIRS) {
    const at = Date.now();
    const pulse = await buildMarketPulse(provider, symbol, at);
    assert.equal(pulse.provenance.synthetic, false);
    assert.equal(pulse.provenance.currency, 'USDT');
    assert.equal(pulse.provenance.freshness, 'REALTIME');
    assert.equal(pulse.ticks.length, 121);
    assert(pulse.ticks.every(t => t.time <= at && t.price > 0));
    const historical = await provider.getPriceAt(symbol, at - 63000);
    assert(historical.provenance.sourceTimestamp <= at - 63000);
    assert.deepEqual(historical.price, (await provider.getPriceAt(symbol, at - 63000)).price);
    results.push({ symbol, source: pulse.provenance.provider, sourceTimestamp: pulse.provenance.sourceTimestamp, price: pulse.quote.price, observations: pulse.ticks.length });
  }
  console.log(JSON.stringify({ results, realOrders: 0, realCharges: 0 }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
