import type { MarketStatus, MarketSession } from '@tl/types';

/**
 * Estado del mercado a partir de la sesión declarada del instrumento.
 * Es una aproximación educativa: no contempla festivos de cada plaza, y así
 * se indica al usuario en la interfaz.
 */
export function marketStatusFor(session: MarketSession, at: number): MarketStatus {
  if (session.alwaysOpen) return 'OPEN';

  const d = new Date(at);
  const day = d.getUTCDay();
  const minute = d.getUTCHours() * 60 + d.getUTCMinutes();

  if (!session.days.includes(day)) return 'CLOSED';
  if (minute < session.openMinuteUtc) {
    // Media hora antes de la apertura se considera preapertura.
    return session.openMinuteUtc - minute <= 30 ? 'PRE_OPEN' : 'CLOSED';
  }
  if (minute >= session.closeMinuteUtc) return 'CLOSED';
  return 'OPEN';
}

/**
 * Último instante en el que el mercado estuvo abierto, hacia atrás desde `at`.
 * Cuando el mercado está cerrado, el precio mostrado se congela en este punto,
 * para no simular movimientos que no existieron.
 */
export function lastOpenTimestamp(session: MarketSession, at: number): number {
  if (session.alwaysOpen) return at;
  if (marketStatusFor(session, at) === 'OPEN') return at;

  // Retrocede en pasos de 15 minutos hasta 10 días atrás.
  const STEP = 15 * 60 * 1000;
  const LIMIT = (10 * 24 * 60 * 60 * 1000) / STEP;
  let t = at;
  for (let i = 0; i < LIMIT; i++) {
    t -= STEP;
    if (marketStatusFor(session, t) === 'OPEN') return t;
  }
  return at;
}

export function nextOpenTimestamp(session: MarketSession, at: number): number | null {
  if (session.alwaysOpen) return null;
  const STEP = 5 * 60 * 1000;
  const LIMIT = (10 * 24 * 60 * 60 * 1000) / STEP;
  let t = at;
  for (let i = 0; i < LIMIT; i++) {
    t += STEP;
    if (marketStatusFor(session, t) === 'OPEN') return t;
  }
  return null;
}

export const MARKET_STATUS_LABEL: Record<MarketStatus, string> = {
  OPEN: 'Mercado abierto',
  CLOSED: 'Mercado cerrado',
  PRE_OPEN: 'Preapertura',
  HOLIDAY: 'Festivo',
};
