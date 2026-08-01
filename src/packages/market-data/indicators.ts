import type { Candle, IndicatorDescriptor, IndicatorId } from '@tl/types';

/**
 * Cálculo de indicadores. Todo se resuelve aquí, de forma determinística y en
 * el servidor cuando alimenta a la IA: el modelo **nunca** calcula ni inventa
 * lecturas de indicadores, solo interpreta las que recibe.
 */

export const INDICATORS: IndicatorDescriptor[] = [
  { id: 'SMA20', label: 'Media móvil simple 20', placement: 'overlay', minPlan: 'FREE', description: 'Promedio del precio de cierre de las últimas 20 velas.' },
  { id: 'SMA50', label: 'Media móvil simple 50', placement: 'overlay', minPlan: 'FREE', description: 'Promedio de 50 velas: suele leerse como tendencia intermedia.' },
  { id: 'SMA200', label: 'Media móvil simple 200', placement: 'overlay', minPlan: 'STANDARD', description: 'Referencia habitual de tendencia de largo plazo.' },
  { id: 'EMA12', label: 'Media exponencial 12', placement: 'overlay', minPlan: 'FREE', description: 'Media que da más peso a los datos recientes.' },
  { id: 'EMA26', label: 'Media exponencial 26', placement: 'overlay', minPlan: 'STANDARD', description: 'Media exponencial más lenta, base del MACD.' },
  { id: 'BB20', label: 'Bandas de Bollinger 20', placement: 'overlay', minPlan: 'STANDARD', description: 'Bandas a dos desviaciones típicas de la media de 20 periodos.' },
  { id: 'VWAP', label: 'VWAP de sesión', placement: 'overlay', minPlan: 'STANDARD', description: 'Precio medio ponderado por volumen desde el inicio de la sesión.' },
  { id: 'RSI14', label: 'RSI 14', placement: 'pane', minPlan: 'FREE', description: 'Oscilador de fuerza relativa entre 0 y 100.' },
  { id: 'MACD', label: 'MACD 12/26/9', placement: 'pane', minPlan: 'STANDARD', description: 'Diferencia entre dos medias exponenciales y su señal.' },
  { id: 'ATR14', label: 'ATR 14', placement: 'pane', minPlan: 'STANDARD', description: 'Rango verdadero medio: mide volatilidad, no dirección.' },
  { id: 'STOCH14', label: 'Estocástico 14/3', placement: 'pane', minPlan: 'STANDARD', description: 'Posición del cierre dentro del rango reciente.' },
  { id: 'VOLUME', label: 'Volumen', placement: 'pane', minPlan: 'FREE', description: 'Actividad negociada en cada vela.' },
];

export const INDICATOR_BY_ID = new Map(INDICATORS.map((i) => [i.id, i]));

type Series = Array<number | null>;

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function stdev(values: number[], period: number, means: Series): Series {
  const out: Series = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const mean = means[i];
    if (mean == null) continue;
    let acc = 0;
    for (let j = i - period + 1; j <= i; j++) acc += (values[j] - mean) ** 2;
    out[i] = Math.sqrt(acc / period);
  }
  return out;
}

export function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  const sd = stdev(values, period, mid);
  const upper: Series = mid.map((m, i) => (m == null || sd[i] == null ? null : m + mult * sd[i]!));
  const lower: Series = mid.map((m, i) => (m == null || sd[i] == null ? null : m - mult * sd[i]!));
  return { mid, upper, lower };
}

export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const fastE = ema(values, fast);
  const slowE = ema(values, slow);
  const line: Series = values.map((_, i) =>
    fastE[i] == null || slowE[i] == null ? null : fastE[i]! - slowE[i]!,
  );
  const defined = line.filter((v): v is number => v != null);
  const signalDefined = ema(defined, signalPeriod);
  const offset = line.length - defined.length;
  const signal: Series = new Array(values.length).fill(null);
  for (let i = 0; i < signalDefined.length; i++) signal[i + offset] = signalDefined[i];
  const histogram: Series = line.map((v, i) => (v == null || signal[i] == null ? null : v - signal[i]!));
  return { line, signal, histogram };
}

export function atr(candles: Candle[], period = 14): Series {
  const out: Series = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;
  const tr: number[] = candles.map((c, i) => {
    if (i === 0) return c.h - c.l;
    const prev = candles[i - 1].c;
    return Math.max(c.h - c.l, Math.abs(c.h - prev), Math.abs(c.l - prev));
  });
  let prev = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  out[period] = prev;
  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export function stochastic(candles: Candle[], period = 14, smooth = 3) {
  const k: Series = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].h > hh) hh = candles[j].h;
      if (candles[j].l < ll) ll = candles[j].l;
    }
    k[i] = hh === ll ? 50 : ((candles[i].c - ll) / (hh - ll)) * 100;
  }
  const defined = k.filter((v): v is number => v != null);
  const dDefined = sma(defined, smooth);
  const offset = k.length - defined.length;
  const d: Series = new Array(candles.length).fill(null);
  for (let i = 0; i < dDefined.length; i++) d[i + offset] = dDefined[i];
  return { k, d };
}

/** VWAP reiniciado cada día UTC. */
export function vwap(candles: Candle[]): Series {
  const out: Series = new Array(candles.length).fill(null);
  let day = -1;
  let pv = 0;
  let vol = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const d = Math.floor(c.t / 86400000);
    if (d !== day) {
      day = d;
      pv = 0;
      vol = 0;
    }
    const typical = (c.h + c.l + c.c) / 3;
    pv += typical * c.v;
    vol += c.v;
    out[i] = vol > 0 ? pv / vol : null;
  }
  return out;
}

export interface ComputedIndicators {
  overlays: Partial<Record<IndicatorId, Series>>;
  bollinger: { mid: Series; upper: Series; lower: Series } | null;
  rsi: Series | null;
  macd: { line: Series; signal: Series; histogram: Series } | null;
  atr: Series | null;
  stochastic: { k: Series; d: Series } | null;
}

export function computeIndicators(candles: Candle[], ids: IndicatorId[]): ComputedIndicators {
  const closes = candles.map((c) => c.c);
  const set = new Set(ids);
  const overlays: Partial<Record<IndicatorId, Series>> = {};

  if (set.has('SMA20')) overlays.SMA20 = sma(closes, 20);
  if (set.has('SMA50')) overlays.SMA50 = sma(closes, 50);
  if (set.has('SMA200')) overlays.SMA200 = sma(closes, 200);
  if (set.has('EMA12')) overlays.EMA12 = ema(closes, 12);
  if (set.has('EMA26')) overlays.EMA26 = ema(closes, 26);
  if (set.has('VWAP')) overlays.VWAP = vwap(candles);

  return {
    overlays,
    bollinger: set.has('BB20') ? bollinger(closes, 20, 2) : null,
    rsi: set.has('RSI14') ? rsi(closes, 14) : null,
    macd: set.has('MACD') ? macd(closes) : null,
    atr: set.has('ATR14') ? atr(candles, 14) : null,
    stochastic: set.has('STOCH14') ? stochastic(candles, 14, 3) : null,
  };
}

/**
 * Últimas lecturas numéricas, redondeadas. Es lo único que se envía al modelo
 * de lenguaje: valores ya calculados, con su nombre. Así el modelo no puede
 * inventar una lectura (regla obligatoria de conducta de la IA).
 */
export function snapshotIndicators(candles: Candle[], ids: IndicatorId[]): Record<string, number | null> {
  if (candles.length === 0) return {};
  const c = computeIndicators(candles, ids);
  const last = candles.length - 1;
  const pick = (s: Series | null | undefined): number | null => {
    if (!s) return null;
    const v = s[last];
    return v == null ? null : Number(v.toFixed(6));
  };

  const snap: Record<string, number | null> = {};
  for (const [key, series] of Object.entries(c.overlays)) snap[key] = pick(series as Series);
  if (c.bollinger) {
    snap['BB20_upper'] = pick(c.bollinger.upper);
    snap['BB20_mid'] = pick(c.bollinger.mid);
    snap['BB20_lower'] = pick(c.bollinger.lower);
  }
  if (c.rsi) snap['RSI14'] = pick(c.rsi);
  if (c.macd) {
    snap['MACD_line'] = pick(c.macd.line);
    snap['MACD_signal'] = pick(c.macd.signal);
    snap['MACD_hist'] = pick(c.macd.histogram);
  }
  if (c.atr) snap['ATR14'] = pick(c.atr);
  if (c.stochastic) {
    snap['STOCH_k'] = pick(c.stochastic.k);
    snap['STOCH_d'] = pick(c.stochastic.d);
  }
  return snap;
}

/** Convierte velas normales a Heikin-Ashi. */
export function toHeikinAshi(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const close = (c.o + c.h + c.l + c.c) / 4;
    const open = i === 0 ? (c.o + c.c) / 2 : (out[i - 1].o + out[i - 1].c) / 2;
    out.push({
      t: c.t,
      o: open,
      c: close,
      h: Math.max(c.h, open, close),
      l: Math.min(c.l, open, close),
      v: c.v,
    });
  }
  return out;
}
