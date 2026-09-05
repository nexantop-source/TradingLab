import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeWompiCheckoutUrl } from '../src/lib/checkout-url';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), userUpdate: vi.fn(), paymentFind: vi.fn(),
  pendingFind: vi.fn(), paymentCreate: vi.fn(), subscriptionFind: vi.fn(),
}));
vi.mock('../src/lib/db', () => ({ db: {
  $transaction: mocks.transaction,
  subscription: { findUnique: mocks.subscriptionFind },
} }));
import { WompiBillingProvider, wompiReference } from '../src/lib/wompi';

const params = { userId: 'account-one', email: 'test@example.com', planId: 'STANDARD' as const, interval: 'MONTHLY' as const, idempotencyKey: 'intent-one-12345678' };
const secret = 'test_integrity_contract-fixture';
const tx = {
  user: { updateMany: mocks.userUpdate },
  subscription: { findUnique: mocks.subscriptionFind },
  payment: { findUnique: mocks.paymentFind, findMany: mocks.pendingFind, create: mocks.paymentCreate },
};

describe('Wompi checkout identity contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('WOMPI_ENVIRONMENT', 'sandbox');
    vi.stubEnv('WOMPI_PUBLIC_KEY', 'pub_test_contract-fixture');
    vi.stubEnv('WOMPI_INTEGRITY_SECRET', secret);
    vi.stubEnv('WOMPI_PRIVATE_KEY', '');
    vi.stubEnv('WOMPI_EVENTS_SECRET', 'test_events_contract-fixture');
    vi.stubEnv('WOMPI_STANDARD_MONTHLY_AMOUNT_IN_CENTS', '5990000');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://tradinglab.example');
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    mocks.userUpdate.mockResolvedValue({ count: 1 });
    mocks.paymentFind.mockResolvedValue(null);
    mocks.subscriptionFind.mockResolvedValue(null);
    mocks.pendingFind.mockResolvedValue([]);
    mocks.paymentCreate.mockImplementation(async ({ data }) => ({ id: 'payment-one', createdAt: new Date(), externalId: null, ...data }));
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns the persisted payment ID, account-bound reference and exact signed expiration', async () => {
    const checkout = await new WompiBillingProvider().createCheckout(params);
    expect(checkout.status).toBe('REDIRECT');
    if (checkout.status !== 'REDIRECT') throw new Error('Expected redirect');
    const url = new URL(checkout.redirectUrl);
    expect(checkout.paymentId).toBe('payment-one');
    expect(checkout.provider).toBe('wompi');
    expect(checkout.environment).toBe('sandbox');
    expect(checkout.reference).toBe(wompiReference(params.userId, params.idempotencyKey, secret));
    expect(checkout.reference).toBe(url.searchParams.get('reference'));
    expect(checkout.expiresAt).toBe(url.searchParams.get('expiration-time'));
    expect(url.searchParams.get('amount-in-cents')).toBe('5990000');
    expect(mocks.paymentCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: params.userId, status: 'PENDING', amountCents: 5990000 }) });
    expect(JSON.stringify(checkout)).not.toContain(secret);
    expect(JSON.stringify(checkout)).not.toContain(params.email);
  });

  it('does not reuse the same reference across two accounts with the same client key', async () => {
    const first = await new WompiBillingProvider().createCheckout(params);
    const second = await new WompiBillingProvider().createCheckout({ ...params, userId: 'account-two' });
    expect(first.reference).not.toBe(second.reference);
  });

  it('retains the payment ID and reference for retries without creating another payment', async () => {
    const first = await new WompiBillingProvider().createCheckout(params);
    const persisted = await mocks.paymentCreate.mock.results[0].value;
    mocks.paymentFind.mockResolvedValue(persisted);
    const second = await new WompiBillingProvider().createCheckout(params);
    expect(second.paymentId).toBe(first.paymentId);
    expect(second.reference).toBe(first.reference);
    expect(second.redirectUrl).toBe(first.redirectUrl);
    expect(mocks.paymentCreate).toHaveBeenCalledTimes(1);
  });
  it.each(['WOMPI_EVENTS_SECRET', 'NEXT_PUBLIC_APP_URL'])('fails before creating a payment when %s is missing', async key => {
    vi.stubEnv(key, '');
    await expect(new WompiBillingProvider().createCheckout(params)).rejects.toMatchObject({ code: 'WOMPI_NOT_CONFIGURED' });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe('checkout destination safety', () => {
  it('allows the official HTTPS checkout', () => {
    expect(safeWompiCheckoutUrl('https://checkout.wompi.co/p/?reference=test')).toBe('https://checkout.wompi.co/p/?reference=test');
  });
  it.each([
    'https://checkout.wompi.co.evil.example/p/', 'http://checkout.wompi.co/p/',
    'https://checkout.wompi.co:444/p/', 'https://user:pass@checkout.wompi.co/p/',
    'https://checkout.wompi.co/elsewhere', 'javascript:alert(1)',
  ])('rejects an unsafe destination: %s', value => {
    expect(() => safeWompiCheckoutUrl(value)).toThrow();
  });
});
