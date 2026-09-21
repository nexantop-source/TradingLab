import type { MarketStatus, MarketSession } from '@tl/types';
import { newYorkTime, newYorkInstant, usEquityHoliday, usEquityCloseMinute } from './us-calendar';
import { colombiaHoliday } from './colombia-calendar';

/** Session calendar: US cash holidays/early closes and New York DST; reference sessions elsewhere. */
export function marketStatusFor(session: MarketSession, at: number): MarketStatus {
  if (session.alwaysOpen) return 'OPEN';
  if (!Number.isFinite(at)) return 'CLOSED';
  if (session.calendar === 'CO_SPOT' && colombiaHoliday(at)) return 'HOLIDAY';
  if (session.calendar === 'US_EQUITY' || session.calendar === 'FOREX_NY') {
    const local = newYorkTime(at);
    if (session.calendar === 'US_EQUITY') {
      if (local.day === 0 || local.day === 6) return 'CLOSED';
      if (usEquityHoliday(local.date)) return 'HOLIDAY';
      if (local.minute < 570) return local.minute >= 540 ? 'PRE_OPEN' : 'CLOSED';
      return local.minute < usEquityCloseMinute(local.date) ? 'OPEN' : 'CLOSED';
    }
    // FX is an OTC weekly session, not the US cash-equity holiday calendar.
    if (local.day === 6 || (local.day === 5 && local.minute >= 1020)) return 'CLOSED';
    if (local.day === 0 && local.minute < 1020) return local.minute >= 990 ? 'PRE_OPEN' : 'CLOSED';
    return 'OPEN';
  }

  const d = new Date(at);
  const day = d.getUTCDay();
  const minute = d.getUTCHours() * 60 + d.getUTCMinutes();

  // Ventana semanal continua: divisas, metales y energía abren el domingo por
  // la tarde y no vuelven a cerrar hasta el viernes. Se resuelve sobre el
  // minuto de la semana, no sobre el del día.
  if (session.weekly) {
    const minuteOfWeek = day * 1440 + minute;
    const { openMinuteUtc, closeMinuteUtc } = session.weekly;
    if (minuteOfWeek >= closeMinuteUtc) {
      return openMinuteUtc - minuteOfWeek <= 30 && openMinuteUtc > minuteOfWeek ? 'PRE_OPEN' : 'CLOSED';
    }
    if (minuteOfWeek < openMinuteUtc) {
      return openMinuteUtc - minuteOfWeek <= 30 ? 'PRE_OPEN' : 'CLOSED';
    }
    return 'OPEN';
  }

  if (!session.days.includes(day)) return 'CLOSED';
  if (minute < session.openMinuteUtc) {
    // Media hora antes de la apertura se considera preapertura.
    return session.openMinuteUtc - minute <= 30 ? 'PRE_OPEN' : 'CLOSED';
  }
  if (minute >= session.closeMinuteUtc) return 'CLOSED';
  return 'OPEN';
}

/** Calendar closures take precedence; old observations can additionally close a reference session. */
export function observedMarketStatus(
  session: MarketSession,
  at: number,
  lastTradeAt: number,
  quietMs = 90 * 60_000,
): MarketStatus {
  const declarado = marketStatusFor(session, at);
  if (declarado !== 'OPEN') return declarado;
  if (!Number.isFinite(lastTradeAt) || lastTradeAt <= 0) return declarado;
  return at - lastTradeAt > quietMs ? 'CLOSED' : 'OPEN';
}

/**
 * Último instante en el que el mercado estuvo abierto, hacia atrás desde `at`.
 * Cuando el mercado está cerrado, el precio mostrado se congela en este punto,
 * para no simular movimientos que no existieron.
 */
export function lastOpenTimestamp(session: MarketSession, at: number): number {
  if (session.alwaysOpen) return at;
  if (marketStatusFor(session, at) === 'OPEN') return at;
  if (session.calendar === 'US_EQUITY' || session.calendar === 'FOREX_NY') {
    const { date } = newYorkTime(at);
    for (let offset = 0; offset < 15; offset++) {
      const candidate = date - offset * 86400000;
      if (session.calendar === 'FOREX_NY' && new Date(candidate).getUTCDay() !== 5) continue;
      const last = newYorkInstant(candidate, session.calendar === 'US_EQUITY' ? usEquityCloseMinute(candidate) : 1020) - 1;
      if (last <= at && marketStatusFor(session, last) === 'OPEN') return last;
    }
    return at;
  }

  // Ventana semanal: el único cierre de la semana es el del viernes. Buscarlo
  // recorriendo días hacia atrás daba el final del jueves, porque el viernes
  // por la noche ya no cumple la condición de estar abierto.
  if (session.weekly) {
    const d = new Date(at);
    const desdeInicioDeSemana =
      (d.getUTCDay() * 1440 + d.getUTCHours() * 60 + d.getUTCMinutes()) * 60_000 +
      d.getUTCSeconds() * 1000 +
      d.getUTCMilliseconds();
    const inicioDeSemana = at - desdeInicioDeSemana;
    const cierre = inicioDeSemana + session.weekly.closeMinuteUtc * 60_000 - 1;
    // Antes de la apertura del domingo, el último cierre es el de la semana
    // anterior; después del cierre del viernes, el de esta.
    return cierre <= at ? cierre : cierre - 7 * 86_400_000;
  }

  // Resolve the calendar boundary, not steps relative to the request time.
  // Otherwise every closed-market refresh produces a different "last" price.
  const day = new Date(at);
  const midnight = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  for (let offset = 0; offset < 10; offset++) {
    const start = midnight - offset * 86_400_000;
    if (!session.days.includes(new Date(start).getUTCDay())) continue;
    const last = start + session.closeMinuteUtc * 60_000 - 1;
    if (last <= at && marketStatusFor(session, last) === 'OPEN') return last;
  }
  return at;
}

export function nextOpenTimestamp(session: MarketSession, at: number): number | null {
  if (session.alwaysOpen) return null;
  const STEP = 5 * 60 * 1000;
  const LIMIT = (10 * 24 * 60 * 60 * 1000) / STEP;
  let t = Math.floor(at / STEP) * STEP;
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
  HOLIDAY: 'Mercado cerrado · festivo',
};
