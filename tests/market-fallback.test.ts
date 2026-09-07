import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompositeMarketDataProvider } from '../src/packages/market-data/composite-provider';
import { resetYahooCache } from '../src/packages/market-data/yahoo-provider';
import { resetFxFallbackCache } from '../src/packages/market-data/fx-fallback-provider';
import { resetFinnhubCache } from '../src/packages/market-data/finnhub-provider';

/**
 * Qué sobrevive cuando la fuente principal nos cierra la puerta.
 *
 * Yahoo cubre el 80 % del catálogo y es una API no publicada: bloquea rangos de
 * centros de datos cada cierto tiempo. El fallo que importa no es que caiga
 * -eso va a pasar-, es lo que hacemos cuando cae.
 *
 * Durante un tiempo la respuesta fue la peor posible: el catálogo entero salía
 * del motor determinístico y se publicaba un dólar a 3.343 pesos. La segunda
 * peor es la que había hasta ahora en el camino por lotes: doscientos sesenta y
 * ocho instrumentos desaparecían de la lista aunque una segunda fuente supiera
 * cotizar la mayoría.
 *
 * Aquí no hay red: se sustituye `fetch` y se comprueba el enrutado, que es
 * exactamente lo que se rompe sin darse cuenta.
 */

const YAHOO = 'finance.yahoo.com';
const BINANCE = 'data-api.binance.vision';
const FINNHUB = 'finnhub.io';
const ERAPI = 'open.er-api.com';

function fakeNetwork(handler: (url: string) => unknown | null) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body = handler(url);
    if (body === null) return new Response('Too Many Requests', { status: 429 });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

/** Respuestas mínimas que cada fuente considera válidas. */
const responses = {
  binanceTicker: [
    { symbol: 'BTCUSDT', lastPrice: '80000', openPrice: '79000', highPrice: '81000', lowPrice: '78000', volume: '10', closeTime: Date.now() },
  ],
  finnhubQuote: { c: 320, pc: 328, h: 329, l: 317, o: 328, t: Math.floor(Date.now() / 1000) },
  erapiRates: { result: 'success', time_last_update_unix: Math.floor(Date.now() / 1000), rates: { USD: 1, EUR: 0.86, COP: 3140.8, JPY: 156.1 } },
};

describe('cuando la fuente principal cae', () => {
  beforeEach(() => {
    // Las tres cachés viven en el módulo: sin vaciarlas, una prueba se apoya en
    // lo que dejó la anterior y deja de comprobar lo que dice comprobar.
    resetYahooCache();
    resetFxFallbackCache();
    resetFinnhubCache();
    process.env.FINNHUB_API_KEY = 'clave-de-prueba';
    process.env.REQUIRE_REAL_MARKET_DATA = 'true';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rescata por la segunda fuente lo que la primera no devolvió', async () => {
    fakeNetwork((url) => {
      if (url.includes(YAHOO)) return null;
      if (url.includes(BINANCE) && url.includes('ticker/24hr')) return responses.binanceTicker;
      if (url.includes(FINNHUB)) return responses.finnhubQuote;
      if (url.includes(ERAPI)) return responses.erapiRates;
      return null;
    });

    const provider = new CompositeMarketDataProvider();
    const quotes = await provider.getQuotes(['BTCUSD', 'AAPL', 'EURUSD', 'USDCOP']);
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

    // Cripto por Binance, acción por Finnhub, divisas por la referencia diaria.
    expect(bySymbol.get('BTCUSD')?.provenance.providerLabel).toContain('Binance');
    expect(bySymbol.get('AAPL')?.provenance.providerLabel).toContain('Finnhub');
    expect(bySymbol.get('EURUSD')?.provenance.providerLabel).toContain('Referencia diaria');
    // El cruce se calcula: 3140,8 pesos por dólar.
    expect(bySymbol.get('USDCOP')?.price).toBeCloseTo(3140.8, 1);
  });

  it('nunca sirve un precio inventado, ni siquiera a oscuras', async () => {
    // Todo caído menos Binance: lo que no tiene fuente tiene que faltar, no
    // aparecer con un número que nadie ha cotizado.
    fakeNetwork((url) => (url.includes(BINANCE) && url.includes('ticker/24hr') ? responses.binanceTicker : null));

    const provider = new CompositeMarketDataProvider();
    const quotes = await provider.getQuotes(['BTCUSD', 'AAPL', 'EURUSD', 'SPX500', 'XAUUSD']);

    expect(quotes.every((q) => q.provenance.synthetic === false)).toBe(true);
    expect(quotes.map((q) => q.symbol)).toEqual(['BTCUSD']);
  });

  it('índices y materias primas fallan y lo dicen: no tienen respaldo gratuito', async () => {
    fakeNetwork((url) => (url.includes(ERAPI) ? responses.erapiRates : null));
    const provider = new CompositeMarketDataProvider();
    await expect(provider.getQuote('SPX500')).rejects.toThrow();
    await expect(provider.getQuote('XAUUSD')).rejects.toThrow();
  });

  it('el respaldo de divisas no inventa un histórico que no tiene', async () => {
    fakeNetwork((url) => (url.includes(ERAPI) ? responses.erapiRates : null));
    const provider = new CompositeMarketDataProvider();
    // Un gráfico en blanco con un motivo escrito es mejor que una línea que no
    // ocurrió: el histórico no cae al respaldo, falla.
    await expect(provider.getCandles({ symbol: 'EURUSD', timeframe: '1d', limit: 30 })).rejects.toThrow();
  });
});

describe('el motor determinístico no puede colarse en producción', () => {
  it('Binance se niega a simular lo que no cotiza cuando se exigen datos reales', async () => {
    process.env.REQUIRE_REAL_MARKET_DATA = 'true';
    const { BinanceMarketDataProvider } = await import('../src/packages/market-data/binance-provider');
    const binance = new BinanceMarketDataProvider();
    // Esta era la puerta de atrás: con MARKET_DATA_PROVIDER=binance, cada
    // acción y cada divisa salían de aquí con un precio generado.
    await expect(binance.getQuote('AAPL')).rejects.toThrow(/no cotiza AAPL/);
    await expect(binance.getCandles({ symbol: 'EURUSD', timeframe: '1d', limit: 10 })).rejects.toThrow();
  });

  it('en desarrollo sigue sirviendo para las lecciones', async () => {
    process.env.REQUIRE_REAL_MARKET_DATA = 'false';
    const { BinanceMarketDataProvider } = await import('../src/packages/market-data/binance-provider');
    const binance = new BinanceMarketDataProvider();
    const quote = await binance.getQuote('AAPL');
    expect(quote.provenance.synthetic).toBe(true);
  });
});
