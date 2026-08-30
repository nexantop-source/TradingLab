/**
 * Formateo. Todo el producto usa estas funciones: así los precios, los
 * porcentajes y las fechas se ven igual en toda la aplicación.
 */

const numberFormatters = new Map<string, Intl.NumberFormat>();

function nf(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let f = numberFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    numberFormatters.set(key, f);
  }
  return f;
}

/** Importe virtual desde centavos. Siempre se acompaña de la marca DEMO en la UI. */
export function formatVirtualUsd(cents: number, locale = 'es-ES'): string {
  return nf(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

export function formatVirtualUsdCompact(cents: number, locale = 'es-ES'): string {
  const value = cents / 100;
  if (Math.abs(value) >= 1000) {
    return nf(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  return nf(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatPrice(price: number, precision: number, locale = 'es-ES'): string {
  return nf(locale, { minimumFractionDigits: precision, maximumFractionDigits: precision }).format(price);
}

export function formatPercent(value: number, decimals = 2, locale = 'es-ES'): string {
  const formatted = nf(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${value > 0 ? '+' : ''}${formatted} %`;
}

export function formatCompactNumber(value: number, locale = 'es-ES'): string {
  return nf(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatUsd(value: number, locale = 'es-ES'): string {
  return nf(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

/** Importe monetario real. A diferencia del saldo DEMO, conserva la moneda del pago. */
export function formatCurrency(value: number, currency: string, locale?: string): string {
  const normalized = /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
  return nf(locale ?? (normalized === 'COP' ? 'es-CO' : 'es-ES'), {
    style: 'currency',
    currency: normalized,
    maximumFractionDigits: normalized === 'COP' ? 0 : 2,
  }).format(value);
}

/** Oculta metadatos de conciliación sin alterar el valor persistido. */
export function formatPaymentDescription(description: string): string {
  return description
    .replace(/\s*\[tl:wompi:v1:(?:STANDARD|PREMIUM):(?:MONTHLY|YEARLY)\]\s*$/, '')
    .trim();
}

/** Fecha y hora en la zona indicada. Se usa la zona del perfil del usuario. */
export function formatDateTime(
  value: Date | string | number,
  timezone = 'UTC',
  locale = 'es-ES',
): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(d);
}

export function formatTime(value: Date | string | number, timezone = 'UTC', locale = 'es-ES'): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: timezone }).format(d);
}

export function formatDate(value: Date | string | number, timezone = 'UTC', locale = 'es-ES'): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: timezone }).format(d);
}

/** Tiempo relativo corto: «hace 3 min», «en 2 h». */
export function formatRelative(value: Date | string | number, locale = 'es'): string {
  const d = value instanceof Date ? value : new Date(value);
  const diffMs = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const abs = Math.abs(diffMs);

  if (abs < 60_000) return rtf.format(Math.round(diffMs / 1000), 'second');
  if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
  if (abs < 2_592_000_000) return rtf.format(Math.round(diffMs / 86_400_000), 'day');
  return rtf.format(Math.round(diffMs / 2_592_000_000), 'month');
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24} h`;
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
