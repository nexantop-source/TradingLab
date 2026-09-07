import { describe, expect, it } from 'vitest';
import { SYMBOLS, getSymbol, searchSymbols, SyntheticMarketDataProvider } from '@tl/market-data';
import { entitlements } from '@tl/types/plans';
import { canLoadGoogleAd } from '../src/components/ads/google-config';
import { selectAd } from '@tl/ads';

describe('investment catalog and subscription boundaries', () => {
  it('makes every new ETF discoverable and supplies deterministic demo candles', async () => {
    const provider = new SyntheticMarketDataProvider();
    const etfs = SYMBOLS.filter(s => s.assetClass === 'ETF');
    // El catalogo crece; lo que no puede es encoger hasta dejar de ofrecer una
    // gama de fondos, ni repetir un identificador.
    expect(etfs.length).toBeGreaterThanOrEqual(15);
    expect(new Set(SYMBOLS.map(s => s.symbol)).size).toBe(SYMBOLS.length);
    for (const s of etfs) {
      expect(getSymbol(s.symbol)).toBe(s);
      expect(searchSymbols(s.symbol).some(result => result.symbol === s.symbol)).toBe(true);
      const params = { symbol: s.symbol, timeframe: '1h' as const, limit: 12, to: Date.UTC(2026, 8, 4, 16) };
      const a = await provider.getCandles(params);
      expect(a.provenance.synthetic).toBe(true);
      expect(a.candles.every(c => Number.isFinite(c.c) && c.c > 0)).toBe(true);
      expect((await provider.getCandles(params)).candles).toEqual(a.candles);
    }
  });
  it('includes risk-managed practice in the limited free plan', () => {
    const free = entitlements('FREE');
    expect(free.simulationModes).toContain('POSITION');
    expect(free.simulationsPerDay).toBe(5);
    expect(free.priceMonthlyUsd).toBe(0);
    expect(free.adDensity).not.toBe('none');
  });
  it.each(['STANDARD', 'PREMIUM'] as const)('blocks Google and internal ad requests for %s', plan => {
    expect(canLoadGoogleAd({ enabled: true, consent: 'granted', plan, code: 'public-banner', page: 'mercados', publisherId: 'ca-pub-1234567890123456', slotId: '1234567890' })).toBe(false);
    for (let seed = 0; seed < 4; seed++) {
      const result = selectAd({ slotCode: 'public-banner', targeting: { plan, countryCode: null, locale: 'es', device: 'desktop', page: 'mercados', educationalTopic: null, marketInterest: [], hourLocal: 12 }, candidates: [], impressionsToday: {}, now: 0, rotationSeed: seed });
      expect(result.ad).toBeNull();
      expect(result.reason).toMatch(/PLAN_.*NO_ADS/);
    }
  });
});
