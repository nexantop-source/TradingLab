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

/**
 * Estado del mercado según lo que dice la fuente, no según nuestro calendario.
 *
 * El calendario es una aproximación y se equivoca de tres formas distintas: no
 * conoce los festivos -daba por abierto el Día del Trabajo estadounidense-, no
 * acierta los minutos exactos de veintitrés plazas repartidas por el mundo, y
 * no sigue los cambios de horario de verano de cada una.
 *
 * Cuando se equivoca, la interfaz enseña un instrumento activo con un precio
 * que lleva horas sin moverse, y quien lo mira no tiene forma de saber cuál de
 * las dos cosas es verdad.
 *
 * La fuente sí sabe cuándo se cruzó el último precio. Si dice que hace horas,
 * ese mercado no está negociando, diga lo que diga la tabla. El calendario
 * sigue sirviendo para lo que sí sabe: anunciar cuándo vuelve a abrir.
 *
 * El margen es generoso a propósito. Un par exótico puede pasar veinte minutos
 * sin cruzar a media tarde y seguir perfectamente abierto; lo que se busca no
 * son minutos de más, son discrepancias de horas.
 */
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
