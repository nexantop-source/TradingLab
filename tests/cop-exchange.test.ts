import { describe, expect, it, vi } from 'vitest';
import { colombiaDay, convertUsdToCopCents, createTrmReader, exchangeQuoteTag, parseCurrentTrm, readExchangeQuote } from '../src/lib/cop-exchange';

const now = new Date('2026-09-05T18:00:00Z');
const row = { valor: '3126.08', unidad: 'COP', vigenciadesde: '2026-09-05T00:00:00', vigenciahasta: '2026-09-08T00:00:00' };
const response = (data: unknown = [row]) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

describe('official COP exchange quotes', () => {
  it('uses the Colombia calendar, not the server UTC date', () => {
    expect(colombiaDay(new Date('2026-09-06T04:59:59Z'))).toBe('2026-09-05');
    expect(colombiaDay(new Date('2026-09-06T05:00:00Z'))).toBe('2026-09-06');
  });
  it('honors the inclusive validity range, including weekends and holidays', () => {
    expect(parseCurrentTrm([row], new Date('2026-09-09T04:59:59Z')).rateHundredths).toBe(312608);
    expect(() => parseCurrentTrm([row], new Date('2026-09-09T05:00:00Z'))).toThrow();
  });
  it.each([
    [], [row, row], [{ ...row, unidad: 'USD' }], [{ ...row, valor: 'NaN' }],
    [{ ...row, valor: '-3126' }], [{ ...row, valor: '0' }], [{ ...row, valor: '3126.081' }],
    [{ ...row, valor: '999999' }], [{ ...row, vigenciadesde: '2026-09-06T00:00:00' }],
    [{ ...row, vigenciahasta: '2026-09-04T00:00:00' }],
    [{ ...row, vigenciadesde: '2026-02-30T00:00:00' }],
    [{ ...row, vigenciahasta: '2027-09-05T00:00:00' }],
  ].map(payload => ({ payload })))('rejects missing, ambiguous, stale or malformed rates: $payload', ({ payload }) => {
    expect(() => parseCurrentTrm(payload, now)).toThrow();
  });
  it('rounds once to the nearest centavo without an exchange surcharge', () => {
    expect(convertUsdToCopCents(1499, 312608)).toBe(4685994);
    expect(convertUsdToCopCents(14900, 312608)).toBe(46578592);
    expect(convertUsdToCopCents(2999, 312608)).toBe(9375114);
    expect(convertUsdToCopCents(29900, 312608)).toBe(93469792);
    expect(convertUsdToCopCents(1, 10050)).toBe(101);
  });
  it.each([[0, 312608], [-1, 312608], [1.5, 312608], [1499, Infinity], [Number.MAX_SAFE_INTEGER, 312608]])('rejects invalid arithmetic %j', (usd, rate) => {
    expect(() => convertUsdToCopCents(usd, rate)).toThrow();
  });
  it('persists an auditable quote and detects an amount mismatch', () => {
    const quote = { ...parseCurrentTrm([row], now), usdAmountInCents: 1499 };
    const description = `${exchangeQuoteTag(quote)} Suscripción [tl:wompi:v1:STANDARD:MONTHLY]`;
    expect(readExchangeQuote(description, 4685994)).toEqual(quote);
    expect(() => readExchangeQuote(description, 1)).toThrow();
    expect(() => readExchangeQuote('[tl:fx:v1:broken]', 1)).toThrow();
    expect(readExchangeQuote('Legacy [tl:wompi:v1:STANDARD:MONTHLY]', 5990000)).toBeUndefined();
  });
  it('queries only the fixed official endpoint and caches a current rate for one hour', async () => {
    const fetcher = vi.fn().mockImplementation(async () => response());
    const read = createTrmReader(fetcher, () => now);
    const first = await read();
    first.rateHundredths = 1;
    expect((await read()).rateHundredths).toBe(312608);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url.origin).toBe('https://www.datos.gov.co');
    expect(url.searchParams.get('$where')).toContain('2026-09-05T00:00:00');
    expect(options.cache).toBe('no-store');
    expect(options.redirect).toBe('error');
  });
  it('never falls back to an expired cache if the service fails', async () => {
    let time = now;
    const fetcher = vi.fn().mockResolvedValueOnce(response()).mockRejectedValue(new Error('offline'));
    const read = createTrmReader(fetcher, () => time);
    await read();
    time = new Date('2026-09-09T05:00:00Z');
    await expect(read()).rejects.toThrow('offline');
  });
  it('invalidates yesterday at Colombia midnight even within the one-hour cache TTL', async () => {
    let time = new Date('2026-09-09T04:50:00Z');
    const fetcher = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response([]));
    const read = createTrmReader(fetcher, () => time);
    await read();
    time = new Date('2026-09-09T05:00:00Z');
    await expect(read()).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    () => new Response('unavailable', { status: 503 }),
    () => new Response('not json'),
    () => new Response('x'.repeat(17000)),
    () => new Response('[]', { headers: { 'content-length': '99999' } }),
  ])('fails closed on invalid upstream responses', async makeResponse => {
    const read = createTrmReader(vi.fn().mockResolvedValue(makeResponse()), () => now);
    await expect(read()).rejects.toThrow();
  });
});
