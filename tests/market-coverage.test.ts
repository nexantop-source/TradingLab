import { describe, expect, it } from 'vitest';
import { SYMBOLS, getSymbol } from '../src/packages/market-data/symbols';
import { yahooTicker } from '../src/packages/market-data/yahoo-provider';
import { binancePair } from '../src/packages/market-data/binance-provider';
import { HISTORY_RANGES, historyRange, DEFAULT_HISTORY_RANGE } from '../src/components/trading/historyRanges';

/**
 * El catálogo tuvo durante un tiempo un sesgo que no se veía en el código pero
 * sí en pantalla: solo las criptomonedas resolvían contra una fuente real, así
 * que el explorador -que descarta lo que no tiene precio verdadero- terminaba
 * enseñando únicamente cripto. Estas pruebas fijan lo contrario: cada
 * instrumento tiene fuente, y ninguna clase de activo se queda fuera.
 *
 * No hay red en ninguna: se comprueba el enrutado, que es lo que se rompe al
 * añadir un instrumento y olvidarse de darle ticker.
 */
describe('cobertura de mercado', () => {
  it('enruta cada instrumento del catálogo a una fuente real', () => {
    const huérfanos = SYMBOLS.filter((s) => !binancePair(s.symbol) && !yahooTicker(s.symbol) && !s.upstreamSymbol);
    expect(huérfanos.map((s) => s.symbol)).toEqual([]);
  });

  it('cubre las seis familias de activos, no solo las criptomonedas', () => {
    const cubiertas = new Set(
      SYMBOLS.filter((s) => binancePair(s.symbol) || yahooTicker(s.symbol)).map((s) => s.assetClass),
    );
    expect([...cubiertas].sort()).toEqual(['COMMODITY', 'CRYPTO', 'ETF', 'FOREX', 'INDEX', 'STOCK']);
    // Que haya varias de cada una, y no un único ejemplar de coartada.
    for (const clase of cubiertas) {
      expect(SYMBOLS.filter((s) => s.assetClass === clase).length).toBeGreaterThan(2);
    }
  });

  it('manda las divisas al par al contado y no a un fondo que lo imita', () => {
    expect(yahooTicker('EURUSD')).toBe('EURUSD=X');
    expect(yahooTicker('USDCOP')).toBe('USDCOP=X');
    // El nombre tiene que decir lo mismo que el precio que se va a enseñar.
    expect(getSymbol('EURUSD')?.name).toContain('Euro');
    expect(getSymbol('EURUSD')?.upstreamSymbol).toBeUndefined();
  });

  it('manda índices y materias primas a su subyacente declarado', () => {
    expect(yahooTicker('SPX500')).toBe('^GSPC');
    expect(yahooTicker('NAS100')).toBe('^NDX');
    expect(yahooTicker('GER40')).toBe('^GDAXI');
    expect(yahooTicker('XAUUSD')).toBe('GC=F');
    expect(yahooTicker('XAGUSD')).toBe('SI=F');
    expect(yahooTicker('WTIUSD')).toBe('CL=F');
  });

  it('deja la cripto en Binance, que es quien la entrega por segundo', () => {
    expect(binancePair('BTCUSD')).toBe('BTCUSDT');
    expect(binancePair('AAPL')).toBeNull();
  });

  it('no inventa un ticker para lo que no lo tiene', () => {
    expect(yahooTicker('NO-EXISTE')).toBeNull();
  });

  it('ajusta los decimales a la magnitud del par', () => {
    // Cuatro decimales sobre un peso colombiano de 3.115 son ruido; dos sobre
    // un euro de 1,16 esconderían el movimiento de todo un día.
    expect(getSymbol('USDCOP')?.precision).toBe(2);
    expect(getSymbol('EURUSD')?.precision).toBe(5);
    expect(getSymbol('EURGBP')?.precision).toBe(5);
    expect(getSymbol('EURJPY')?.precision).toBe(3);
    // Una criptomoneda de precio ínfimo sí necesita bajar hasta la millonésima:
    // con cuatro decimales, Shiba Inu valdría cero.
    expect(getSymbol('SHIBUSD')?.precision).toBeGreaterThanOrEqual(6);
  });
});

describe('ventanas de historia de la terminal', () => {
  it('ofrece desde un día hasta todo el historial, sin quedarse en los minutos', () => {
    expect(HISTORY_RANGES.map((r) => r.id)).toEqual(['1D', '1S', '1M', '6M', '1A', '5A', 'MAX']);
    // El techo alto es lo que convierte "cinco años" en "todo": una acción con
    // cuarenta años de historia son más de dos mil velas semanales.
    expect(historyRange('MAX').limit).toBeGreaterThanOrEqual(2500);
    expect(historyRange('MAX').timeframe).toBe('1w');
  });

  it('elige una granularidad proporcional a cada tramo', () => {
    expect(historyRange('1D').timeframe).toBe('5m');
    expect(historyRange('1M').timeframe).toBe('1h');
    expect(historyRange('1A').timeframe).toBe('1d');
  });

  it('abre en un año, que es lo que responde a "¿cómo le ha ido a esto?"', () => {
    expect(DEFAULT_HISTORY_RANGE).toBe('1A');
    expect(historyRange(DEFAULT_HISTORY_RANGE).id).toBe('1A');
  });

  it('cae en un rango razonable cuando le llega uno desconocido', () => {
    expect(historyRange('LIVE').id).toBe('5A');
  });
});
