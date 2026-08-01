import { symbolSeed } from './deterministic';

/**
 * Calendario económico educativo.
 *
 * Genera de forma determinística los eventos macroeconómicos recurrentes
 * (publicaciones periódicas de indicadores) para que el estudiante aprenda a
 * anticiparlos. Los eventos están marcados como `educational: true` y no
 * contienen cifras publicadas: solo el evento, su hora y su impacto esperado.
 *
 * Al conectar un proveedor real de calendario, se implementa `CalendarProvider`
 * y se sustituye `getEconomicEvents`.
 */

export type EventImpact = 'LOW' | 'MEDIUM' | 'HIGH';

export interface EconomicEvent {
  id: string;
  /** ms epoch UTC */
  time: number;
  country: string;
  countryCode: string;
  currency: string;
  title: string;
  impact: EventImpact;
  /** Explicación en lenguaje sencillo de por qué importa. */
  educationalNote: string;
  /** Activos habitualmente sensibles a este evento. */
  relatedSymbols: string[];
  educational: true;
}

interface EventTemplate {
  key: string;
  title: string;
  country: string;
  countryCode: string;
  currency: string;
  impact: EventImpact;
  /** Día del mes aproximado en que suele publicarse. */
  dayOfMonth: number;
  /** Hora UTC de publicación. */
  hourUtc: number;
  minuteUtc: number;
  /** `monthly` una vez al mes; `weekly` un día concreto de la semana. */
  cadence: 'monthly' | 'weekly';
  /** Para cadencia semanal: día (0 domingo). */
  weekday?: number;
  educationalNote: string;
  relatedSymbols: string[];
}

const TEMPLATES: EventTemplate[] = [
  {
    key: 'us-nfp',
    title: 'Empleo no agrícola (Estados Unidos)',
    country: 'Estados Unidos',
    countryCode: 'US',
    currency: 'USD',
    impact: 'HIGH',
    dayOfMonth: 5,
    hourUtc: 12,
    minuteUtc: 30,
    cadence: 'monthly',
    educationalNote:
      'Mide cuántos empleos se crearon fuera del sector agrícola. Suele provocar movimientos bruscos en el dólar y en los índices durante los primeros minutos.',
    relatedSymbols: ['EURUSD', 'USDJPY', 'SPX500', 'XAUUSD'],
  },
  {
    key: 'us-cpi',
    title: 'Índice de precios al consumidor (Estados Unidos)',
    country: 'Estados Unidos',
    countryCode: 'US',
    currency: 'USD',
    impact: 'HIGH',
    dayOfMonth: 12,
    hourUtc: 12,
    minuteUtc: 30,
    cadence: 'monthly',
    educationalNote:
      'Mide la inflación. Condiciona las expectativas sobre los tipos de interés, que a su vez afectan a divisas, bonos, acciones y oro.',
    relatedSymbols: ['EURUSD', 'XAUUSD', 'NAS100', 'BTCUSD'],
  },
  {
    key: 'fed-rate',
    title: 'Decisión de tipos de la Reserva Federal',
    country: 'Estados Unidos',
    countryCode: 'US',
    currency: 'USD',
    impact: 'HIGH',
    dayOfMonth: 19,
    hourUtc: 18,
    minuteUtc: 0,
    cadence: 'monthly',
    educationalNote:
      'El precio del dinero en la mayor economía del mundo. Más importante que la cifra suele ser el mensaje sobre las decisiones futuras.',
    relatedSymbols: ['EURUSD', 'SPX500', 'XAUUSD', 'USDJPY'],
  },
  {
    key: 'ecb-rate',
    title: 'Decisión de tipos del Banco Central Europeo',
    country: 'Zona euro',
    countryCode: 'EU',
    currency: 'EUR',
    impact: 'HIGH',
    dayOfMonth: 14,
    hourUtc: 12,
    minuteUtc: 15,
    cadence: 'monthly',
    educationalNote:
      'Afecta directamente al euro. Compara siempre su dirección con la de la Reserva Federal: el diferencial de tipos mueve al EUR/USD.',
    relatedSymbols: ['EURUSD', 'GER40'],
  },
  {
    key: 'eu-cpi',
    title: 'Inflación de la zona euro (preliminar)',
    country: 'Zona euro',
    countryCode: 'EU',
    currency: 'EUR',
    impact: 'MEDIUM',
    dayOfMonth: 28,
    hourUtc: 10,
    minuteUtc: 0,
    cadence: 'monthly',
    educationalNote:
      'Primera lectura de la inflación europea. Suele anticipar el tono del Banco Central Europeo.',
    relatedSymbols: ['EURUSD', 'GER40'],
  },
  {
    key: 'us-pmi',
    title: 'PMI manufacturero (Estados Unidos)',
    country: 'Estados Unidos',
    countryCode: 'US',
    currency: 'USD',
    impact: 'MEDIUM',
    dayOfMonth: 1,
    hourUtc: 14,
    minuteUtc: 0,
    cadence: 'monthly',
    educationalNote:
      'Encuesta a responsables de compras. Por encima de 50 sugiere expansión; por debajo, contracción.',
    relatedSymbols: ['SPX500', 'WTIUSD'],
  },
  {
    key: 'oil-inventories',
    title: 'Inventarios de petróleo crudo',
    country: 'Estados Unidos',
    countryCode: 'US',
    currency: 'USD',
    impact: 'MEDIUM',
    dayOfMonth: 0,
    hourUtc: 14,
    minuteUtc: 30,
    cadence: 'weekly',
    weekday: 3,
    educationalNote:
      'Variación semanal de las reservas de crudo. Un aumento inesperado suele presionar el precio a la baja.',
    relatedSymbols: ['WTIUSD'],
  },
  {
    key: 'us-jobless',
    title: 'Peticiones semanales de subsidio por desempleo',
    country: 'Estados Unidos',
    countryCode: 'US',
    currency: 'USD',
    impact: 'LOW',
    dayOfMonth: 0,
    hourUtc: 12,
    minuteUtc: 30,
    cadence: 'weekly',
    weekday: 4,
    educationalNote:
      'Dato de alta frecuencia sobre el mercado laboral. Su valor está en la tendencia de varias semanas, no en una lectura aislada.',
    relatedSymbols: ['EURUSD', 'SPX500'],
  },
  {
    key: 'uk-gdp',
    title: 'Producto interior bruto (Reino Unido)',
    country: 'Reino Unido',
    countryCode: 'GB',
    currency: 'GBP',
    impact: 'MEDIUM',
    dayOfMonth: 11,
    hourUtc: 6,
    minuteUtc: 0,
    cadence: 'monthly',
    educationalNote: 'Crecimiento de la economía británica. Influye en la libra y en las expectativas del Banco de Inglaterra.',
    relatedSymbols: ['GBPUSD'],
  },
];

function eventId(key: string, time: number): string {
  return `${key}-${new Date(time).toISOString().slice(0, 10)}`;
}

/**
 * Eventos entre dos instantes. Determinístico: la misma ventana devuelve
 * siempre los mismos eventos.
 */
export function getEconomicEvents(fromMs: number, toMs: number): EconomicEvent[] {
  const out: EconomicEvent[] = [];
  const from = new Date(fromMs);
  const to = new Date(toMs);

  // Recorre día a día la ventana solicitada, con un tope de seguridad.
  const MAX_DAYS = 400;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (let i = 0; i < MAX_DAYS && cursor.getTime() <= to.getTime(); i++) {
    for (const t of TEMPLATES) {
      let matches = false;
      if (t.cadence === 'monthly') {
        matches = cursor.getUTCDate() === t.dayOfMonth;
        // Si cae en fin de semana, se desplaza al lunes siguiente.
        if (matches && (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6)) matches = false;
        if (!matches && t.dayOfMonth >= 1) {
          const shifted = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), t.dayOfMonth));
          if (shifted.getUTCDay() === 0 && cursor.getUTCDate() === t.dayOfMonth + 1) matches = true;
          if (shifted.getUTCDay() === 6 && cursor.getUTCDate() === t.dayOfMonth + 2) matches = true;
        }
      } else {
        matches = cursor.getUTCDay() === t.weekday;
      }
      if (!matches) continue;

      const time = Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate(),
        t.hourUtc,
        t.minuteUtc,
      );
      if (time < fromMs || time > toMs) continue;

      out.push({
        id: eventId(t.key, time),
        time,
        country: t.country,
        countryCode: t.countryCode,
        currency: t.currency,
        title: t.title,
        impact: t.impact,
        educationalNote: t.educationalNote,
        relatedSymbols: t.relatedSymbols,
        educational: true,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return out.sort((a, b) => a.time - b.time);
}

/** Eventos relevantes para un instrumento, en una ventana de días. */
export function getEventsForSymbol(symbol: string, fromMs: number, toMs: number): EconomicEvent[] {
  return getEconomicEvents(fromMs, toMs).filter((e) => e.relatedSymbols.includes(symbol.toUpperCase()));
}

export const IMPACT_LABEL: Record<EventImpact, string> = {
  LOW: 'Impacto bajo',
  MEDIUM: 'Impacto medio',
  HIGH: 'Impacto alto',
};

/** Marcador determinístico usado para variar el orden de listados sin aleatoriedad. */
export function stableOrder(key: string, index: number): number {
  return (symbolSeed(key) + index * 2654435761) % 1000;
}
