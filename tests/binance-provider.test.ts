import { describe, expect, it, vi } from 'vitest';
import { BinanceMarketDataProvider } from '../src/packages/market-data/binance-provider';
import { buildMarketPulse } from '../src/packages/market-data/pulse';

const now = Date.UTC(2026, 8, 6, 12, 2, 30);
function fixture(override?: (url: URL, rows: unknown[]) => unknown) {
  const request = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    expect(url.origin).toBe('https://data-api.binance.vision');
    if (url.pathname.endsWith('ticker/24hr')) return Response.json({ openPrice: '100', highPrice: '120', lowPrice: '90', volume: '1000' });
    expect(url.pathname).toBe('/api/v3/klines');
    const step = url.searchParams.get('interval') === '1s' ? 1000 : 60000;
    const end = Number(url.searchParams.get('endTime'));
    const limit = Number(url.searchParams.get('limit'));
    const start = Number(url.searchParams.get('startTime') ?? (Math.floor(end / step) * step - (limit - 1) * step));
    const rows = Array.from({ length: Math.min(limit, Math.floor((end - start) / step) + 1) }, (_, i) => {
      const t = start + i * step;
      return [t, '100', '110', '90', String(100 + (t / 1000 % 10)), '5', t + step - 1];
    });
    return Response.json(override ? override(url, rows) : rows);
  });
  return { request, provider: new BinanceMarketDataProvider(request as typeof fetch, () => now) };
}

describe('real Binance data, no synthetic substitution', () => {
  it('uses only completed seconds at or before the requested historical time', async () => {
    const { provider } = fixture();
    const at = now - 75250;
    const point = await provider.getPriceAt('BTCUSDT', at);
    expect(point.provenance.sourceTimestamp).toBe(Math.floor(at / 1000) * 1000 - 1);
    expect(point.provenance.synthetic).toBe(false);
    expect(point.provenance.currency).toBe('USDT');
    expect(point.provenance.freshness).toBe('STALE');
  });
  it('returns actual one-second observations and deduplicates initial history fetches', async () => {
    const { provider, request } = fixture();
    const pulse = await buildMarketPulse(provider, 'BTCUSDT', now);
    expect(pulse.ticks).toHaveLength(121);
    expect(pulse.ticks.every(tick=>tick.candle?.h===110 && tick.candle?.l===90)).toBe(true);
    expect(pulse.ticks.at(-1)?.price).toBe(pulse.quote.price);
    expect(pulse.provenance.freshness).toBe('REALTIME');
    expect(pulse.provenance.provider).toBe('binance-spot-v1');
    expect(request.mock.calls.length).toBeLessThanOrEqual(5);
  });
  it('reconstructs partial minute OHLC only from seconds before the cutoff', async () => {
    const { provider } = fixture();
    const result = await provider.getCandles({ symbol: 'ETHUSDT', timeframe: '1m', limit: 3, to: now - 12000 });
    expect(result.candles).toHaveLength(3);
    expect(result.candles.at(-1)?.t).toBe(now - 30000);
    expect(result.candles.at(-1)?.v).toBe(18 * 5);
    expect(result.provenance.sourceTimestamp).toBe(now - 12001);
  });
  it('cotiza los identificadores heredados contra el par real de Binance', async () => {
    // `BTCUSD` es el identificador del catalogo; el par que existe de verdad es
    // `BTCUSDT`. Antes estos simbolos se servian con el motor deterministico
    // para que las simulaciones antiguas fueran reproducibles, pero eso
    // significaba que el instrumento mas visible del producto ensenaba un
    // precio inventado. La traduccion vive en el proveedor y lo que se devuelve
    // conserva el identificador del catalogo.
    const { provider, request } = fixture();
    const point = await provider.getPriceAt('BTCUSD', now);
    expect(point.provenance.synthetic).toBe(false);
    expect(request).toHaveBeenCalled();
    expect(request.mock.calls[0][0]).toContain('symbol=BTCUSDT');
  });

  it('no inventa un precio para un instrumento que Binance no cotiza', async () => {
    // Sin par real cae al motor deterministico, y lo declara: el peligro no es
    // simular, es simular sin decirlo junto a precios verdaderos.
    const { provider } = fixture();
    const point = await provider.getPriceAt('AAPL', now);
    expect(point.provenance.synthetic).toBe(true);
  });
  it.each([403, 451, 500])('blocks when the exchange returns HTTP %s', async status => {
    const provider = new BinanceMarketDataProvider(async () => new Response('', { status }), () => now);
    await expect(provider.getQuote('SOLUSDT')).rejects.toThrow(/no está disponible/);
  });
  it.each(['empty', 'nan', 'future', 'bad-volume', 'unsorted'])('rejects %s exchange observations', async bad => {
    const { provider } = fixture((_url, rows) => {
      if (bad === 'empty') return [];
      if (bad === 'future') return [[now + 1000, '100', '110', '90', '100', '1', now + 1999]];
      if (bad === 'unsorted') return rows.reverse();
      const last = rows.at(-1) as unknown[];
      last[bad === 'nan' ? 4 : 5] = 'NaN';
      return rows;
    });
    await expect(provider.getPriceAt('BTCUSDT', now)).rejects.toThrow();
  });
  it('refuses future requests', async () => {
    const { provider, request } = fixture();
    await expect(provider.getPriceAt('BTCUSDT', now + 10001)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
