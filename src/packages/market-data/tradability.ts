import type { DataProvenance } from '@tl/types';
import { getSymbol } from './symbols';
import { marketStatusFor } from './market-hours';

/**
 * ¿Se puede abrir un ejercicio contra esta cotización?
 *
 * La regla anterior era un número: diez segundos de antigüedad máxima. Estaba
 * escrita pensando en Binance, que entrega un precio por segundo, y funcionaba
 * para cripto. Para todo lo demás significaba que **nunca** se podía abrir
 * nada: la marca de una acción, una divisa o el oro tiene minutos de
 * antigüedad incluso con el mercado en pleno movimiento, así que el euro y el
 * oro se rechazaban a cualquier hora del día con un mensaje que decía que no
 * había cotización vigente cuando la había, y era buena.
 *
 * El margen sale ahora de lo que la propia fuente promete. Un proveedor que
 * declara quince minutos de retraso no está fallando cuando entrega un precio
 * de hace cinco: está cumpliendo. Exigirle lo que promete otro no es
 * prudencia, es impedir el producto.
 *
 * Lo que no se relaja es lo que de verdad protege a la persona:
 *
 *   · un precio simulado no abre nada, nunca;
 *   · una marca fechada en el futuro es un dato corrupto, no un dato rápido;
 *   · `STALE` y `SIMULATED` son las dos formas que tiene un proveedor de decir
 *     «esto ya no describe el mercado», y se le cree.
 *
 * El retraso viaja con el precio hasta la pantalla: quien abre un ejercicio ve
 * de qué fuente salió y con cuánto retraso, y queda escrito en la auditoría.
 *
 * Vive aquí y no en el servicio de simulación porque es una pregunta sobre el
 * dato, no sobre el ejercicio, y porque así se puede probar sin arrastrar medio
 * servidor detrás.
 */
export function quoteIsTradable(
  quote: { symbol?: string; provenance: DataProvenance },
  provider: { declaredDelaySeconds: number },
  now = Date.now(),
): boolean {
  const session = quote.symbol ? getSymbol(quote.symbol)?.session : undefined;
  if (session && marketStatusFor(session, now) !== 'OPEN') return false;
  const { synthetic, freshness, sourceTimestamp } = quote.provenance;
  if (synthetic || quote.provenance.marketStatus !== 'OPEN' || freshness === 'MARKET_CLOSED') return false;
  if (!Number.isFinite(sourceTimestamp)) return false;
  // Un reloj adelantado por delante del nuestro es tolerable; un precio fechado
  // dentro de un minuto no lo es.
  if (sourceTimestamp > now + 60_000) return false;
  if (freshness === 'SIMULATED' || freshness === 'STALE') return false;

  const margen = Math.max(60_000, Math.min(provider.declaredDelaySeconds, 900) * 1000);
  return now - sourceTimestamp <= margen;
}
