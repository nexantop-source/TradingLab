/**
 * Generador de series determinístico.
 *
 * Propiedad clave: `priceAt(symbol, t)` devuelve **siempre** el mismo valor
 * para la misma pareja (símbolo, instante). No hay estado, no hay aleatoriedad
 * en tiempo de ejecución y no depende de la base de datos.
 *
 * Esto es lo que hace auditable al motor de simulación: cualquier resultado
 * puede recalcularse meses después y verificarse (criterio de aceptación #5).
 */

/** Hash entero de 32 bits, estable y sin dependencias (variante de xorshift/MurmurHash finalizer). */
function hash32(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b >>> 0), 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

/** Semilla numérica estable a partir del símbolo. */
export function symbolSeed(symbol: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h ^ symbol.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Pseudoaleatorio determinístico en [0, 1). */
function rand(seed: number, index: number): number {
  return hash32(seed, index) / 4294967296;
}

/** Ruido de valor con interpolación suave (smoothstep) en una octava dada. */
function valueNoise(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = rand(seed, i) * 2 - 1;
  const b = rand(seed, i + 1) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return a * (1 - u) + b * u;
}

/**
 * Ruido fractal (suma de octavas). Produce una serie continua con estructura
 * en varias escalas temporales: tendencias largas, oscilaciones intradía y
 * ruido de corto plazo, que es exactamente lo que un estudiante necesita ver.
 */
function fractalNoise(seed: number, x: number, octaves = 6): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(seed + o * 7919, x * frequency) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03; // frecuencia no entera: evita que las octavas se alineen
  }
  return sum / norm;
}

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

export interface SeriesParams {
  symbol: string;
  basePrice: number;
  annualVolatility: number;
  annualDrift: number;
}

/**
 * Precio determinístico del instrumento en el instante `t` (ms epoch).
 *
 * El modelo es un movimiento log-normal cuya componente aleatoria proviene del
 * ruido fractal determinístico. No pretende replicar un mercado real: es una
 * serie educativa reproducible y explícitamente marcada como sintética.
 */
export function priceAt(params: SeriesParams, t: number): number {
  const seed = symbolSeed(params.symbol);
  const years = t / MS_PER_YEAR;

  // Tres escalas: macro (meses), media (días) y micro (minutos).
  const macro = fractalNoise(seed, years * 6, 4);
  const mid = fractalNoise(seed + 104729, years * 365, 5);
  const micro = fractalNoise(seed + 1299709, years * 365 * 96, 4);

  // Cada escala aporta una fracción de la volatilidad anual declarada.
  const logMove =
    macro * params.annualVolatility * 1.0 +
    mid * params.annualVolatility * 0.35 +
    micro * params.annualVolatility * 0.12 +
    params.annualDrift * years;

  const price = params.basePrice * Math.exp(logMove);
  return price;
}

/**
 * Construye una vela OHLCV a partir del precio determinístico.
 * El máximo y el mínimo se derivan submuestreando el intervalo, de modo que
 * `h >= max(o,c)` y `l <= min(o,c)` se cumplen por construcción.
 */
export function candleAt(
  params: SeriesParams,
  openTime: number,
  durationMs: number,
  elapsedMs = durationMs,
): { o: number; h: number; l: number; c: number; v: number } {
  // Keep the candle's original duration/seed. A forming candle may only
  // inspect elapsed time; using its scheduled close would reveal the future.
  const elapsed = Math.max(0, Math.min(elapsedMs, durationMs));
  const SUBSAMPLES = 12;
  let h = -Infinity;
  let l = Infinity;
  const o = priceAt(params, openTime);
  const c = priceAt(params, openTime + elapsed);

  for (let i = 0; i <= SUBSAMPLES; i++) {
    const p = priceAt(params, openTime + (elapsed * i) / SUBSAMPLES);
    if (p > h) h = p;
    if (p < l) l = p;
  }
  h = Math.max(h, o, c);
  l = Math.min(l, o, c);

  // Volumen determinístico con estacionalidad horaria y correlación con el rango.
  const seed = symbolSeed(params.symbol) + 31337;
  const bucket = Math.floor(openTime / durationMs);
  const hourOfDay = new Date(openTime).getUTCHours();
  // Curva en U: más actividad en aperturas y solapamientos de sesión.
  const seasonal = 0.6 + 0.4 * Math.abs(Math.cos(((hourOfDay - 14) / 24) * Math.PI * 2));
  const range = (h - l) / Math.max(o, 1e-9);
  const base = 1 + rand(seed, bucket) * 1.4;
  const progress = durationMs > 0 ? elapsed / durationMs : 0;
  const v = Math.round(base * seasonal * (1 + range * 220) * 10000 * progress);

  return { o, h, l, c, v };
}

/** Redondea al tick del instrumento, evitando arrastrar errores de coma flotante. */
export function roundToTick(price: number, tickSize: number, precision: number): number {
  const rounded = Math.round(price / tickSize) * tickSize;
  return Number(rounded.toFixed(precision));
}
