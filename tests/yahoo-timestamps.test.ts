import { buildMarketPulse } from '../src/packages/market-data/pulse';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YahooMarketDataProvider, resetYahooCache } from '../src/packages/market-data/yahoo-provider';

describe('Yahoo quote observation timestamps', () => {
  beforeEach(() => resetYahooCache());
  afterEach(() => vi.unstubAllGlobals());
  const provider = new YahooMarketDataProvider();
  function reply(body: unknown) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
  }
  it('keeps the original observation in the pulse without fabricating seconds', async () => {
    reply({ chart: { result: [{ meta: { regularMarketPrice: 200, regularMarketTime: 1_750_000_000 } }] } });
    const pulse = await buildMarketPulse(provider, 'AAPL', 1_750_000_120_000);
    expect(pulse.ticks).toEqual([{ time: 1_750_000_000_000, price: 200 }]);
    expect(pulse.quote.bid).toBe(200);
    expect(pulse.quote.ask).toBe(200);
  });
  it('does not substitute a USD quote for a USDT instrument', () => {
    expect(provider.supports('BTCUSDT')).toBe(false);
    expect(provider.supports('BTCUSD')).toBe(true);
  });
  it('rejects an undated price instead of stamping it with the current time', async () => {
    reply({ chart: { result: [{ meta: { regularMarketPrice: 200 } }] } });
    await expect(provider.getQuote('AAPL')).rejects.toThrow('no tiene cotización');
  });
  it('uses a dated bar and its matching close when the quote has no timestamp', async () => {
    reply({ chart: { result: [{ meta: { regularMarketPrice: 999 }, timestamp: [1_750_000_000], indicators: { quote: [{ open: [190], high: [205], low: [185], close: [200] }] } }] } });
    const quote = await provider.getQuote('AAPL');
    expect(quote.price).toBe(200);
    expect(quote.provenance.sourceTimestamp).toBe(1_750_000_000_000);
  });
  it('does not attach a null closing point timestamp to an older valid price', async () => {
    reply({ AAPL: { close: [200, null], timestamp: [1_750_000_000, 1_750_000_300], previousClose: 195 } });
    const [quote] = await provider.getQuotes(['AAPL']);
    expect(quote.price).toBe(200);
    expect(quote.provenance.sourceTimestamp).toBe(1_750_000_000_000);
  });
});
