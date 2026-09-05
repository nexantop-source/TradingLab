/** Official SFC TRM published on Colombia's open-data portal. Server use only. */
export const TRM_SOURCE_URL = 'https://www.datos.gov.co/Econom-a-y-Finanzas/Tasa-de-Cambio-Representativa-del-Mercado-TRM/32sa-8pi3';
const TRM_API = 'https://www.datos.gov.co/resource/32sa-8pi3.json';
const MAX_BYTES = 16 * 1024;

export interface TrmRate {
  source: 'SFC_TRM';
  /** COP per USD multiplied by 100, to keep monetary arithmetic integral. */
  rateHundredths: number;
  validFrom: string;
  validThrough: string;
}
export interface CopExchangeQuote extends TrmRate {
  usdAmountInCents: number;
}

export function colombiaDay(now: Date): string {
  return new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function rateCovers(rate: TrmRate, now: Date): boolean {
  const day = colombiaDay(now);
  return day >= rate.validFrom && day <= rate.validThrough;
}

export function parseCurrentTrm(payload: unknown, now: Date): TrmRate {
  if (!Array.isArray(payload) || payload.length !== 1) throw new Error('TRM unavailable or ambiguous');
  const row = payload[0];
  if (!row || row.unidad !== 'COP' || typeof row.valor !== 'string' ||
      !/^\d{1,6}(?:\.\d{1,2})?$/.test(row.valor)) throw new Error('Invalid TRM value');
  const date = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?$/.test(value) ||
        !validDay(value.slice(0, 10))) throw new Error('Invalid TRM validity');
    return value.slice(0, 10);
  };
  const rate: TrmRate = {
    source: 'SFC_TRM',
    rateHundredths: Math.round(Number(row.valor) * 100),
    validFrom: date(row.vigenciadesde),
    validThrough: date(row.vigenciahasta),
  };
  if (rate.rateHundredths < 10_000 || rate.rateHundredths > 10_000_000 ||
      rate.validFrom > rate.validThrough || !rateCovers(rate, now) ||
      Date.parse(rate.validThrough) - Date.parse(rate.validFrom) > 7 * 86400000) {
    throw new Error('TRM outside valid bounds');
  }
  return rate;
}

export function convertUsdToCopCents(usdAmountInCents: number, rateHundredths: number): number {
  const product = usdAmountInCents * rateHundredths;
  if (!Number.isSafeInteger(usdAmountInCents) || usdAmountInCents <= 0 ||
      !Number.isSafeInteger(rateHundredths) || rateHundredths < 10_000 || rateHundredths > 10_000_000 ||
      !Number.isSafeInteger(product)) throw new Error('Invalid currency conversion');
  const amount = Math.round(product / 100);
  if (amount <= 0 || amount > 2_147_483_647) throw new Error('Amount outside payment limits');
  return amount;
}

export function createTrmReader(fetcher: typeof fetch = fetch, clock: () => Date = () => new Date()) {
  let cached: { rate: TrmRate; fetchedAt: number } | undefined;
  return async (): Promise<TrmRate> => {
    const now = clock();
    if (cached && now.getTime() - cached.fetchedAt < 3600000 &&
        now.getTime() >= cached.fetchedAt && rateCovers(cached.rate, now)) return { ...cached.rate };
    const day = colombiaDay(now);
    const url = new URL(TRM_API);
    url.searchParams.set('$where', `vigenciadesde <= '${day}T00:00:00' AND vigenciahasta >= '${day}T00:00:00'`);
    url.searchParams.set('$limit', '2');
    const response = await fetcher(url, {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(4000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok || !response.body || Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) {
      throw new Error('TRM service unavailable');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) throw new Error('TRM response too large');
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const rate = parseCurrentTrm(JSON.parse(Buffer.concat(chunks).toString('utf8')), clock());
    cached = { rate, fetchedAt: clock().getTime() };
    return { ...rate };
  };
}

export const currentTrm = createTrmReader();

/** Stored beside existing plan metadata so retries need neither live FX nor a schema migration. */
export function exchangeQuoteTag(quote: CopExchangeQuote): string {
  return `[tl:fx:v1:${quote.usdAmountInCents}:${quote.rateHundredths}:${quote.validFrom}:${quote.validThrough}]`;
}

export function readExchangeQuote(description: string, amountInCents: number): CopExchangeQuote | undefined {
  const match = /\[tl:fx:v1:(\d+):(\d+):(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})\]/.exec(description);
  if (!match) {
    if (description.includes('[tl:fx:')) throw new Error('Invalid persisted exchange quote');
    return undefined; // Legacy fixed-COP payment.
  }
  const quote: CopExchangeQuote = {
    source: 'SFC_TRM', usdAmountInCents: Number(match[1]), rateHundredths: Number(match[2]),
    validFrom: match[3], validThrough: match[4],
  };
  if (!validDay(quote.validFrom) || !validDay(quote.validThrough) || quote.validFrom > quote.validThrough ||
      convertUsdToCopCents(quote.usdAmountInCents, quote.rateHundredths) !== amountInCents) {
    throw new Error('Invalid persisted exchange quote');
  }
  return quote;
}
