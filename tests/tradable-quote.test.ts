import { describe, expect, it } from 'vitest';
import type { DataProvenance } from '@tl/types';
import { quoteIsTradable } from '../src/packages/market-data/tradability';

/**
 * La puerta que decide si se puede abrir un ejercicio contra un precio.
 *
 * Estuvo cerrada para casi todo el catálogo sin que nadie lo notara. La regla
 * era un número -diez segundos de antigüedad máxima-, escrito pensando en
 * Binance, que entrega un precio por segundo. Para cualquier otra fuente
 * significaba que **nunca** se podía abrir nada: el euro y el oro se rechazaban
 * a cualquier hora, con el mercado en pleno movimiento, y el mensaje decía que
 * no había cotización vigente cuando la había y era buena.
 *
 * Estas pruebas fijan la regla nueva: el margen sale de lo que la fuente
 * promete, y lo que protege a la persona no se toca.
 */

const AHORA = Date.UTC(2026, 8, 7, 15, 0, 0);

function provenance(over: Partial<DataProvenance> = {}): DataProvenance {
  return {
    provider: 'x',
    providerLabel: 'Fuente',
    sourceTimestamp: AHORA - 5_000,
    receivedTimestamp: AHORA,
    latencyMs: 5_000,
    freshness: 'REALTIME',
    marketStatus: 'OPEN',
    currency: 'USD',
    synthetic: false,
    notice: '',
    ...over,
  };
}

const quote = (over: Partial<DataProvenance> = {}) => ({ provenance: provenance(over) });
/** Binance promete un segundo; Yahoo declara quince minutos. */
const binance = { declaredDelaySeconds: 1 };
const yahoo = { declaredDelaySeconds: 900 };

describe('abrir un ejercicio contra una cotización', () => {
  it('rechaza mercados cerrados aunque su último precio sea reciente', () => {
    for (const marketStatus of ['CLOSED', 'PRE_OPEN', 'HOLIDAY'] as const) {
      expect(quoteIsTradable(quote({ marketStatus, sourceTimestamp: AHORA }), yahoo, AHORA)).toBe(false);
    }
    expect(quoteIsTradable(quote({ freshness: 'MARKET_CLOSED' }), yahoo, AHORA)).toBe(false);
  });
  it('acepta el precio por segundo de una fuente que lo promete', () => {
    expect(quoteIsTradable(quote({ sourceTimestamp: AHORA - 800 }), binance, AHORA)).toBe(true);
  });

  it('acepta el retraso que la fuente declara, en vez de exigirle el de otra', () => {
    // Cinco minutos de una fuente que anuncia quince no es un fallo: es que
    // está cumpliendo. Este es el caso que bloqueaba el euro y el oro.
    expect(quoteIsTradable(quote({ sourceTimestamp: AHORA - 5 * 60_000, freshness: 'DELAYED' }), yahoo, AHORA)).toBe(true);
  });

  it('da un mínimo de un minuto incluso a la fuente más rápida', () => {
    // Un salto de reloj de treinta segundos no puede cerrar el producto.
    expect(quoteIsTradable(quote({ sourceTimestamp: AHORA - 30_000 }), binance, AHORA)).toBe(true);
  });

  it('rechaza lo que pasa del margen de la propia fuente', () => {
    expect(quoteIsTradable(quote({ sourceTimestamp: AHORA - 40 * 60_000 }), yahoo, AHORA)).toBe(false);
    expect(quoteIsTradable(quote({ sourceTimestamp: AHORA - 3 * 86_400_000 }), yahoo, AHORA)).toBe(false);
  });

  it('nunca abre contra un precio simulado, por reciente que sea', () => {
    expect(quoteIsTradable(quote({ synthetic: true, sourceTimestamp: AHORA }), binance, AHORA)).toBe(false);
  });

  it('cree a la fuente cuando dice que su precio ya no describe el mercado', () => {
    for (const freshness of ['STALE', 'SIMULATED'] as const) {
      expect(quoteIsTradable(quote({ freshness, sourceTimestamp: AHORA }), yahoo, AHORA)).toBe(false);
    }
  });

  it('tolera un reloj adelantado, pero no un precio fechado en el futuro', () => {
    // Los relojes de dos servidores nunca coinciden al segundo.
    expect(quoteIsTradable(quote({ sourceTimestamp: AHORA + 2_000 }), yahoo, AHORA)).toBe(true);
    // Un minuto por delante ya no es desfase: es un dato corrupto.
    expect(quoteIsTradable(quote({ sourceTimestamp: AHORA + 120_000 }), yahoo, AHORA)).toBe(false);
  });

  it('rechaza una marca que no es un número', () => {
    expect(quoteIsTradable(quote({ sourceTimestamp: Number.NaN }), yahoo, AHORA)).toBe(false);
  });
});
