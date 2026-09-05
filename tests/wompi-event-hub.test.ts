import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), reconcile: vi.fn(), forward: vi.fn(), receipt: vi.fn() }));
vi.mock('../src/lib/db', () => ({ db: {} }));
vi.mock('../src/lib/api', () => ({
  ok: (data: unknown, init?: ResponseInit) => Response.json({ ok: true, data }, init),
  fail: (code: string, message: string, status: number) => Response.json({ error: { code, message } }, { status }),
  handleError: () => Response.json({ error: 'internal' }, { status: 500 }),
}));
vi.mock('../src/lib/billing', () => ({ processWebhook: mocks.receipt }));
vi.mock('../src/lib/wompi', async original => ({ ...await original<typeof import('../src/lib/wompi')>(), fetchWompiTransaction: mocks.lookup, reconcileWompiTransaction: mocks.reconcile }));
vi.mock('../src/lib/wompi-routing', async original => ({ ...await original<typeof import('../src/lib/wompi-routing')>(), forwardNexantWompiEvent: mocks.forward }));
import { GET, POST } from '../src/app/api/payments/wompi/events/route';

const secret = 'prod_events_fixture_only';
const tx = { id: 'txn_fixture_0001', status: 'APPROVED', currency: 'COP', amount_in_cents: 1234500, reference: `tl_${'a'.repeat(48)}` };
function event(properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']) {
  const timestamp = 1788600000;
  const values = properties.map(p => (tx as Record<string, unknown>)[p.split('.')[1]]).join('');
  return { event: 'transaction.updated', environment: 'prod', data: { transaction: { ...tx } }, timestamp,
    sent_at: '2026-09-05T09:00:00Z', signature: { properties, checksum: createHash('sha256').update(values + timestamp + secret).digest('hex') } };
}
function request(payload: unknown = event(), headers: Record<string, string> = {}) {
  return new NextRequest('https://example.test/api/payments/wompi/events', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });
}
describe('shared Wompi event route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('WOMPI_EVENT_HUB_ENABLED', 'true'); vi.stubEnv('WOMPI_ENVIRONMENT', 'production');
    vi.stubEnv('WOMPI_PUBLIC_KEY', 'pub_prod_fixture_only'); vi.stubEnv('WOMPI_EVENTS_SECRET', secret);
    vi.stubEnv('WOMPI_INTEGRITY_SECRET', ''); vi.stubEnv('WOMPI_PRIVATE_KEY', ''); vi.stubEnv('BILLING_PROVIDER', 'disabled');
    mocks.lookup.mockResolvedValue(tx); mocks.reconcile.mockResolvedValue({}); mocks.forward.mockResolvedValue(undefined);
    mocks.receipt.mockImplementation(async ({ handler }) => { await handler(); return { duplicate: false }; });
  });
  afterEach(() => vi.unstubAllEnvs());
  it('advertises configuration without claiming a transaction was verified', async () => {
    expect(await (await GET()).json()).toMatchObject({ data: { checkoutEnabled: false, environment: 'production' } });
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it('keeps existing payments reconcilable when new checkout is disabled', async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.reconcile).toHaveBeenCalledWith(tx); expect(mocks.forward).not.toHaveBeenCalled();
    expect(mocks.receipt).toHaveBeenCalledWith(expect.objectContaining({ provider: 'wompi-hub' }));
  });
  it('routes using authoritative reference, never the unsigned notification reference', async () => {
    const payload = event(); payload.data.transaction.reference = 'product_abcdefghijklmno';
    expect((await POST(request(payload))).status).toBe(200);
    expect(mocks.reconcile).toHaveBeenCalledWith(tx); expect(mocks.forward).not.toHaveBeenCalled();
  });
  it('forwards only a verified Nexant payment and waits for acknowledgement', async () => {
    mocks.lookup.mockResolvedValue({ ...tx, reference: 'product_abcdefghijklmno' });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.forward).toHaveBeenCalledOnce(); expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it('leaves unavailable destinations retryable, never responds success', async () => {
    mocks.lookup.mockResolvedValue({ ...tx, reference: 'product_abcdefghijklmno' }); mocks.forward.mockRejectedValue(new Error('unavailable'));
    expect((await POST(request())).status).toBe(500);
  });
  it('records receipt even if Wompi lookup fails', async () => {
    mocks.lookup.mockRejectedValue(new Error('timeout'));
    expect((await POST(request())).status).toBe(500); expect(mocks.receipt).toHaveBeenCalledOnce();
  });
  it('keeps unknown orders for review without crediting either product', async () => {
    mocks.lookup.mockResolvedValue({ ...tx, reference: 'unknown-order' });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.receipt).toHaveBeenCalledOnce(); expect(mocks.reconcile).not.toHaveBeenCalled(); expect(mocks.forward).not.toHaveBeenCalled();
  });
  it('deduplicates completed receipts without executing effects again', async () => {
    mocks.receipt.mockResolvedValue({ duplicate: true });
    expect(await (await POST(request())).json()).toMatchObject({ data: { duplicate: true } }); expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it.each(['signature', 'environment', 'unsigned-id', 'header'])('rejects %s before DB or network', async mode => {
    const payload = mode === 'unsigned-id' ? event(['transaction.status']) : event();
    if (mode === 'signature') payload.signature.checksum = '0'.repeat(64);
    if (mode === 'environment') payload.environment = 'test';
    expect((await POST(request(payload, mode === 'header' ? { 'X-Event-Checksum': '0'.repeat(64) } : {}))).status).toBe(401);
    expect(mocks.receipt).not.toHaveBeenCalled(); expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it('rejects large bodies before admission', async () => {
    expect((await POST(request({ padding: 'a'.repeat(66000) }))).status).toBe(413);
    expect(mocks.receipt).not.toHaveBeenCalled();
  });
});
