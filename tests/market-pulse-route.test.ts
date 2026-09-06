import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const fixture = vi.hoisted(() => ({ auth: vi.fn(), enforce: vi.fn(), build: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  requireAuth: fixture.auth,
  ForbiddenError: class ForbiddenError extends Error { status = 403; },
}));
vi.mock('@/lib/rate-limit', () => ({ enforce: fixture.enforce, RATE_LIMITS: { marketData: { limit: 240, windowSeconds: 60 } } }));
vi.mock('@/lib/api', () => ({
  ok: (data: unknown) => NextResponse.json({ ok: true, data }),
  handleError: (error: Error & { status?: number }) => NextResponse.json({ ok: false, error: { message: error.message } }, {
    status: error.status ?? (error.name === 'ZodError' ? 422 : 500),
    headers: error.status === 429 ? { 'Retry-After': '20' } : undefined,
  }),
}));
vi.mock('@/packages/market-data/pulse', () => ({ buildMarketPulse: fixture.build }));
import { GET } from '@/app/api/market/pulse/route';

const req = (query = 'symbol=BTCUSD') => new NextRequest(`https://tradinglab.example/api/market/pulse?${query}`);
describe('market pulse endpoint security contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.auth.mockResolvedValue({ user: { id: 'student-id', plan: 'FREE' } });
    fixture.enforce.mockResolvedValue(undefined);
    fixture.build.mockResolvedValue({ symbol: 'BTCUSD', mode: 'DEMO', ticks: [] });
  });
  it('requires authentication before any provider lookup', async () => {
    fixture.auth.mockRejectedValue(Object.assign(new Error('Inicia sesión.'), { status: 401 }));
    const response = await GET(req());
    expect(response.status).toBe(401);
    expect(fixture.build).not.toHaveBeenCalled();
    expect(fixture.enforce).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('rate limits the authenticated identity and cannot be publicly cached', async () => {
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect(fixture.enforce).toHaveBeenCalledWith('pulse:student-id', { limit: 240, windowSeconds: 60 });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(response.headers.get('Vary')).toBe('Cookie');
  });
  it('checks the instrument entitlement on the server', async () => {
    const response = await GET(req('symbol=NVDA'));
    expect(response.status).toBe(403);
    expect(fixture.build).not.toHaveBeenCalled();
  });
  it.each(['symbol=BTCUSD&since=NaN', 'symbol=BTCUSD&since=-1', 'symbol=BTCUSD&since=1.5', 'symbol=BTCUSD&since=99999999999999999999', 'symbol='])('rejects malformed input: %s', async query => {
    expect((await GET(req(query))).status).toBe(422);
    expect(fixture.build).not.toHaveBeenCalled();
  });
  it('rejects future cursors and returns no-store for validation errors', async () => {
    const response = await GET(req(`symbol=BTCUSD&since=${Date.now() + 60_000}`));
    expect(response.status).toBe(422);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(fixture.build).not.toHaveBeenCalled();
  });
  it('preserves retry-after and does not run the provider when limited', async () => {
    fixture.enforce.mockRejectedValue(Object.assign(new Error('Espera.'), { status: 429 }));
    const response = await GET(req());
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('20');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(fixture.build).not.toHaveBeenCalled();
  });
});
