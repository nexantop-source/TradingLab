import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSameOriginRequest } from '../src/lib/request-origin';
const publicOrigin = 'https://tradinglab.example';
const request = (headers: Record<string, string> = {}, url = 'http://0.0.0.0:8080/api/billing/subscribe') => ({ headers: new Headers(headers), nextUrl: new URL(url) });

describe('billing origin validation behind Firebase proxy', () => {
  beforeEach(() => { vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('NEXT_PUBLIC_APP_URL', publicOrigin); });
  afterEach(() => vi.unstubAllEnvs());
  it('accepts the configured public origin despite an internal HTTP listener', () => {
    expect(isSameOriginRequest(request({ origin: publicOrigin, 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOriginRequest(request({ origin: publicOrigin }))).toBe(true);
  });
  it.each(['https://evil.invalid', 'https://tradinglab.example.evil.invalid', 'http://tradinglab.example', 'https://tradinglab.example:444', 'null', 'https://tradinglab.example/', 'http://0.0.0.0:8080'])('rejects mismatched Origin %s', origin => {
    expect(isSameOriginRequest(request({ origin, referer: publicOrigin + '/pago', 'sec-fetch-site': 'same-origin' }))).toBe(false);
  });
  it.each(['cross-site', 'same-site', 'none'])('rejects contradictory Fetch Metadata %s', fetchSite => {
    expect(isSameOriginRequest(request({ origin: publicOrigin, 'sec-fetch-site': fetchSite }))).toBe(false);
  });
  it('does not trust attacker-controlled forwarding headers', () => {
    expect(isSameOriginRequest(request({ origin: 'https://evil.invalid', host: 'evil.invalid', 'x-forwarded-host': 'evil.invalid', 'x-forwarded-proto': 'https' }, 'https://evil.invalid/api/billing/subscribe'))).toBe(false);
  });
  it('allows missing Origin only with a trusted Referer or same-origin metadata', () => {
    expect(isSameOriginRequest(request({ referer: publicOrigin + '/pago?plan=STANDARD' }))).toBe(true);
    expect(isSameOriginRequest(request({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOriginRequest(request())).toBe(false);
    expect(isSameOriginRequest(request({ referer: 'https://evil.invalid/pago', 'sec-fetch-site': 'same-origin' }))).toBe(false);
  });
  it.each(['', 'not a url', 'http://tradinglab.example', 'https://user:pass@tradinglab.example'])('fails closed with unsafe production configuration %s', value => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', value);
    expect(isSameOriginRequest(request({ origin: publicOrigin }))).toBe(false);
  });
  it('uses the actual request origin for local development, not production configuration', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isSameOriginRequest(request({ origin: 'http://localhost:3010' }, 'http://localhost:3010/api/billing/subscribe'))).toBe(true);
    expect(isSameOriginRequest(request({ origin: publicOrigin }, 'http://localhost:3010/api/billing/subscribe'))).toBe(false);
  });
});
