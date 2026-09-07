import type { Timeframe } from '@tl/types';

/**
 * Ventanas de historia que ofrece la terminal.
 *
 * Antes solo se podía mirar uno o dos minutos, que es la ventana del pulso en
 * vivo. Eso sirve para ver latir un precio, pero no para entender un activo:
 * quien pregunta "¿cómo le ha ido a esto?" necesita ver la subida de 2020, la
 * caída de 2022 y dónde está hoy respecto de las dos.
 *
 * Cada ventana elige su propia temporalidad porque la granularidad correcta
 * depende del tramo: cinco minutos dentro de un día, una semana dentro de
 * cuarenta años. Pedir velas de un minuto para una década no daría más detalle,
 * daría medio millón de puntos ilegibles.
 */
export interface HistoryRange {
  id: string;
  /** Etiqueta corta del selector. */
  label: string;
  /** Nombre completo, para lectores de pantalla y para el resumen. */
  title: string;
  timeframe: Timeframe;
  limit: number;
}

export const HISTORY_RANGES: HistoryRange[] = [
  { id: '1D', label: '1D', title: 'un día', timeframe: '5m', limit: 300 },
  { id: '1S', label: '1S', title: 'una semana', timeframe: '30m', limit: 400 },
  { id: '1M', label: '1M', title: 'un mes', timeframe: '1h', limit: 400 },
  { id: '6M', label: '6M', title: 'seis meses', timeframe: '1d', limit: 190 },
  { id: '1A', label: '1A', title: 'un año', timeframe: '1d', limit: 370 },
  { id: '5A', label: '5A', title: 'cinco años', timeframe: '1w', limit: 300 },
  // El techo alto es lo que convierte "5 años" en "todo": una acción con
  // cuarenta años de historia son unas dos mil cuatrocientas velas semanales.
  { id: 'MAX', label: 'TODO', title: 'todo su historial', timeframe: '1w', limit: 5000 },
];

export const DEFAULT_HISTORY_RANGE = '1A';

export function historyRange(id: string): HistoryRange {
  return HISTORY_RANGES.find((range) => range.id === id) ?? HISTORY_RANGES[HISTORY_RANGES.length - 2];
}
