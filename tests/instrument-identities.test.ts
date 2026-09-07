import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SYMBOLS } from '@tl/market-data';
import identities from '../src/components/investment/instrument-identities.json';
import { monogramHue, monogramText } from '../src/components/investment/AssetIcon';

/**
 * El catálogo pasó de cincuenta instrumentos a más de trescientos, y con él
 * cambió la regla de identidad. Exigir arte propia para cada uno significaría
 * no poder añadir ninguno; la regla ahora es que **todo instrumento se
 * identifique**, con su logotipo cuando lo tiene y con un monograma legible
 * cuando no. Lo que sigue prohibido es lo de siempre: un icono genérico de
 * clase repetido veinte veces, que no distingue nada.
 */
describe('instrument identities', () => {
  const inventory = identities as Record<string, { label: string; src: string; secondary?: string; kind?: string }>;
  const catalog = new Set(SYMBOLS.map((s) => s.symbol));

  it('no deja identidades huérfanas apuntando a instrumentos que ya no existen', () => {
    expect(Object.keys(inventory).filter((symbol) => !catalog.has(symbol))).toEqual([]);
  });

  it('da logotipo propio a los instrumentos que la gente busca por su marca', () => {
    for (const symbol of ['BTCUSD', 'ETHUSD', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'SPY', 'QQQ', 'EURUSD', 'XAUUSD']) {
      expect(catalog.has(symbol)).toBe(true);
      expect(inventory[symbol]?.src).toBeTruthy();
    }
  });

  it('describe cada identidad y empareja las dos patas de un cruce de divisas', () => {
    for (const [symbol, identity] of Object.entries(inventory)) {
      expect(identity.label.length).toBeGreaterThan(1);
      const instrument = SYMBOLS.find((s) => s.symbol === symbol)!;
      // Una divisa con bandera tiene que llevar las dos: media identidad es
      // peor que ninguna, porque sugiere un par que no es el que se mira.
      if (instrument.assetClass === 'FOREX' && identity.src.includes('flag-')) {
        expect(identity.secondary).toBeTruthy();
      }
      if (instrument.assetClass === 'ETF') expect(identity.kind).toBe('fund');
    }
  });

  it('ships safe local SVGs for all primary and counter-currency images', () => {
    const paths = new Set(Object.values(inventory).flatMap((i) => [i.src, i.secondary].filter(Boolean)));
    for (const path of paths) {
      expect(path).toMatch(/^\/assets\/instruments\/[a-z0-9-]+\.svg$/);
      const svg = readFileSync(resolve('public', path!.slice(1)), 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).not.toMatch(/<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/|data:)/i);
    }
  });

  it('distinguishes Bitcoin, Apple and the two legs of EUR/USD', () => {
    expect(inventory.BTCUSD.src).toContain('/btc.svg');
    expect(inventory.AAPL.src).toContain('/apple.svg');
    expect(inventory.EURUSD.src).toContain('/flag-eu.svg');
    expect(inventory.EURUSD.secondary).toContain('/flag-us.svg');
  });
});

describe('monograma de los instrumentos sin logotipo', () => {
  it('enseña la parte que la persona reconoce, no el identificador recortado', () => {
    // El dólar está en media tabla: de USD/BRL lo que identifica es el real.
    expect(monogramText('USDBRL', 'FOREX')).toBe('BRL');
    expect(monogramText('EURJPY', 'FOREX')).toBe('EUR');
    expect(monogramText('ATOMUSD', 'CRYPTO')).toBe('ATOM');
    expect(monogramText('COFFEEUSD', 'COMMODITY', 'KC')).toBe('KC');
    expect(monogramText('US30', 'INDEX', 'DJI')).toBe('DJI');
  });

  it('deduce de la forma cuando nadie le pasa la clase de activo', () => {
    // Media aplicación pinta iconos sabiendo solo el símbolo.
    expect(monogramText('USDCOP')).toBe('COP');
    expect(monogramText('SOLUSD')).toBe('SOL');
    expect(monogramText('AAPL')).toBe('AAPL');
  });

  it('da a cada instrumento un color estable, que es lo que permite reconocerlo', () => {
    expect(monogramHue('USDBRL')).toBe(monogramHue('USDBRL'));
    expect(monogramHue('USDBRL')).not.toBe(monogramHue('USDCLP'));
    for (const symbol of SYMBOLS.slice(0, 40)) {
      const hue = monogramHue(symbol.symbol);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it('cabe en el disco: nunca más de cinco caracteres', () => {
    for (const instrument of SYMBOLS) {
      const text = monogramText(instrument.symbol, instrument.assetClass, instrument.displayTicker);
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(5);
    }
  });
});
