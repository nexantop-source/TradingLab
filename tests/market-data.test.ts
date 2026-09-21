import { describe, it, expect } from 'vitest';
import { SyntheticMarketDataProvider } from '@tl/market-data';
import { priceAt, candleAt, symbolSeed } from '@tl/market-data';
import { sma, ema, rsi, atr, bollinger, macd, snapshotIndicators, toHeikinAshi } from '@tl/market-data';
import { marketStatusFor } from '@tl/market-data';
import type { Candle } from '@tl/types';

const provider = new SyntheticMarketDataProvider();

describe('generador determinístico de series', () => {
  const params = { symbol: 'EURUSD', basePrice: 1.0865, annualVolatility: 0.07, annualDrift: 0 };

  it('devuelve el mismo precio para el mismo instante', () => {
    const t = 1_700_000_000_000;
    expect(priceAt(params, t)).toBe(priceAt(params, t));
  });

  it('produce series distintas para símbolos distintos', () => {
    const t = 1_700_000_000_000;
    const a = priceAt(params, t);
    const b = priceAt({ ...params, symbol: 'GBPUSD' }, t);
    expect(a).not.toBe(b);
  });

  it('la semilla del símbolo es estable', () => {
    expect(symbolSeed('EURUSD')).toBe(symbolSeed('EURUSD'));
    expect(symbolSeed('EURUSD')).not.toBe(symbolSeed('BTCUSD'));
  });

  it('las velas cumplen la invariante máximo ≥ apertura/cierre ≥ mínimo', () => {
    for (let i = 0; i < 200; i++) {
      const k = candleAt(params, 1_700_000_000_000 + i * 3_600_000, 3_600_000);
      expect(k.h).toBeGreaterThanOrEqual(Math.max(k.o, k.c));
      expect(k.l).toBeLessThanOrEqual(Math.min(k.o, k.c));
      expect(k.v).toBeGreaterThan(0);
    }
  });
});

describe('proveedor sintético', () => {
  it('devuelve cotizaciones con procedencia completa', async () => {
    const quote = await provider.getQuote('EURUSD');
    expect(quote.provenance.provider).toBe('synthetic-v1');
    expect(quote.provenance.synthetic).toBe(true);
    expect(quote.provenance.notice.length).toBeGreaterThan(20);
    expect(quote.ask).toBeGreaterThan(quote.bid);
  });

  it('la latencia declarada es finita y razonable incluso en consultas históricas', async () => {
    const past = Date.now() - 30 * 86400000;
    const { provenance } = await provider.getPriceAt('EURUSD', past);
    expect(provenance.latencyMs).toBeLessThan(60_000);
    expect(Number.isFinite(provenance.latencyMs)).toBe(true);
  });

  it('el precio histórico es reproducible', async () => {
    const t = Date.now() - 5 * 86400000;
    const a = await provider.getPriceAt('BTCUSD', t);
    const b = await provider.getPriceAt('BTCUSD', t);
    expect(a.price).toBe(b.price);
  });

  it('rechaza instrumentos desconocidos', async () => {
    await expect(provider.getQuote('NOEXISTE')).rejects.toThrow();
  });

  it('devuelve velas ordenadas cronológicamente', async () => {
    const series = await provider.getCandles({ symbol: 'BTCUSD', timeframe: '1h', limit: 100 });
    for (let i = 1; i < series.candles.length; i++) {
      expect(series.candles[i].t).toBeGreaterThan(series.candles[i - 1].t);
    }
  });

  it('las criptomonedas cotizan también en fin de semana', () => {
    // Domingo a las 12:00 UTC.
    const sunday = Date.UTC(2026, 0, 18, 12, 0);
    expect(provider.getMarketStatus('BTCUSD', sunday)).toBe('OPEN');
  });

  it('las acciones estadounidenses están cerradas de madrugada', () => {
    const night = Date.UTC(2026, 0, 21, 3, 0); // martes 03:00 UTC
    expect(provider.getMarketStatus('AAPL', night)).toBe('CLOSED');
  });
});

describe('horario de mercado', () => {
  const equity = {
    alwaysOpen: false,
    days: [1, 2, 3, 4, 5],
    openMinuteUtc: 13 * 60 + 30,
    closeMinuteUtc: 20 * 60,
    label: 'test',
  };

  it('abre dentro del horario', () => {
    expect(marketStatusFor(equity, Date.UTC(2026, 0, 20, 15, 0))).toBe('OPEN');
  });

  it('cierra el fin de semana', () => {
    expect(marketStatusFor(equity, Date.UTC(2026, 0, 18, 15, 0))).toBe('CLOSED');
  });

  it('marca preapertura en la media hora previa', () => {
    expect(marketStatusFor(equity, Date.UTC(2026, 0, 20, 13, 15))).toBe('PRE_OPEN');
  });
});

describe('indicadores', () => {
  const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 5);
  const candles: Candle[] = closes.map((c, i) => ({
    t: i * 60000,
    o: c - 0.2,
    h: c + 0.5,
    l: c - 0.5,
    c,
    v: 1000,
  }));

  it('la media simple deja huecos iniciales y luego produce valores', () => {
    const s = sma(closes, 20);
    expect(s[18]).toBeNull();
    expect(s[19]).not.toBeNull();
  });

  it('la media simple de una serie constante es esa constante', () => {
    const flat = new Array(30).fill(50);
    const s = sma(flat, 10);
    expect(s[29]).toBeCloseTo(50, 10);
  });

  it('la media exponencial reacciona antes que la simple', () => {
    const series = [...new Array(30).fill(100), ...new Array(10).fill(120)];
    const e = ema(series, 10);
    const s = sma(series, 10);
    expect(e[35]!).toBeGreaterThan(s[35]!);
  });

  it('el RSI se mantiene entre 0 y 100', () => {
    const r = rsi(closes, 14);
    for (const v of r) {
      if (v == null) continue;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('el RSI de una serie estrictamente creciente tiende a 100', () => {
    const rising = Array.from({ length: 40 }, (_, i) => 100 + i);
    const r = rsi(rising, 14);
    expect(r[39]).toBeCloseTo(100, 5);
  });

  it('el ATR es siempre positivo', () => {
    const a = atr(candles, 14);
    for (const v of a) {
      if (v == null) continue;
      expect(v).toBeGreaterThan(0);
    }
  });

  it('la banda superior de Bollinger está por encima de la media', () => {
    const b = bollinger(closes, 20, 2);
    const last = closes.length - 1;
    expect(b.upper[last]!).toBeGreaterThan(b.mid[last]!);
    expect(b.lower[last]!).toBeLessThan(b.mid[last]!);
  });

  it('el histograma del MACD es la diferencia entre línea y señal', () => {
    const m = macd(closes);
    const last = closes.length - 1;
    if (m.line[last] != null && m.signal[last] != null) {
      expect(m.histogram[last]!).toBeCloseTo(m.line[last]! - m.signal[last]!, 8);
    }
  });

  it('la instantánea de indicadores devuelve valores numéricos o nulos, nunca undefined', () => {
    const snap = snapshotIndicators(candles, ['SMA20', 'RSI14', 'ATR14', 'MACD', 'BB20']);
    for (const [key, value] of Object.entries(snap)) {
      expect(value === null || typeof value === 'number').toBe(true);
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('Heikin-Ashi conserva el número de velas y la invariante de rango', () => {
    const ha = toHeikinAshi(candles);
    expect(ha.length).toBe(candles.length);
    for (const k of ha) {
      expect(k.h).toBeGreaterThanOrEqual(Math.max(k.o, k.c));
      expect(k.l).toBeLessThanOrEqual(Math.min(k.o, k.c));
    }
  });
});
