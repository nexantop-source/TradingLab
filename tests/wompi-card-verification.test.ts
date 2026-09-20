import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { verifyPaymentSource } from '../src/lib/wompi-recurring';
import { fetchWompiTransaction, readWompiConfig } from '../src/lib/wompi';
import { cardInputError } from '../src/lib/card-input';
import { trialAccessVerified } from '../src/lib/active-plan';
const input = { paymentSourceId: 123, email: 'qa@example.invalid', reference: 'qa-verification-123' };
const transaction = { id: 'tx-fixture-123', status: 'APPROVED', amount_in_cents: 150000, currency: 'COP', reference: input.reference };
beforeEach(() => {
  vi.stubEnv('WOMPI_ENVIRONMENT', 'sandbox'); vi.stubEnv('WOMPI_PUBLIC_KEY', 'pub_test_fixture');
  vi.stubEnv('WOMPI_PRIVATE_KEY', 'prv_test_fixture'); vi.stubEnv('WOMPI_INTEGRITY_SECRET', 'test_integrity_fixture');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('verification is bank evidence, not a valid-looking card number', () => {
  it('queries transaction evidence with the private server key', async () => {
    const request = vi.fn(async () => Response.json({ data: transaction }));
    vi.stubGlobal('fetch', request);
    await fetchWompiTransaction(transaction.id);
    expect(request).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer prv_test_fixture' }) }));
  });
  it('does not query payment evidence without a private key', async () => {
    vi.stubEnv('WOMPI_PRIVATE_KEY', '');
    const request = vi.fn(); vi.stubGlobal('fetch', request);
    await expect(fetchWompiTransaction(transaction.id)).rejects.toThrow('llave privada');
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['DECLINED', 'ERROR', 'VOIDED'])('does not grant on %s', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { ...transaction, status } })));
    expect((await verifyPaymentSource(input)).verified).toBe(false);
  });
  it('leaves a pending result unresolved, without claiming it was voided', async () => {
    let time = 0;
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { ...transaction, status: 'PENDING' } })));
    const result = await verifyPaymentSource({ ...input, now: () => time += 30_000 });
    expect(result).toMatchObject({ verified: false, voided: false, status: 'PENDING' });
  });
  it.each([{ reference: 'another-order' }, { amount_in_cents: 1 }, { currency: 'USD' }])('rejects mismatched verification %j', async override => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { ...transaction, ...override } })));
    await expect(verifyPaymentSource(input)).rejects.toThrow();
  });
  it('confirms the final void after an asynchronous response', async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockResolvedValueOnce(Response.json({ data: transaction }))
      .mockResolvedValueOnce(Response.json({ data: { status: 'PENDING' } }))
      .mockResolvedValueOnce(Response.json({ data: { ...transaction, status: 'VOIDED' } }));
    vi.stubGlobal('fetch', request);
    const work = verifyPaymentSource(input);
    await vi.runAllTimersAsync();
    expect(await work).toMatchObject({ verified: true, voided: true });
    expect(request.mock.calls[2][0]).toContain('/transactions/tx-fixture-123');
  });
  it('blocks sandbox configuration in production', () => {
    expect(() => readWompiConfig({ NODE_ENV: 'production', WOMPI_ENVIRONMENT: 'sandbox' })).toThrow('producción');
  });
  it('rejects invalid and expired card fields before tokenization', () => {
    const now = new Date('2026-09-20');
    expect(cardInputError('0000000000000000', '12/30', '123', 'QA HOLDER', now)).not.toBeNull();
    expect(cardInputError('4242424242424242', '08/26', '123', 'QA HOLDER', now)).not.toBeNull();
    expect(cardInputError('4242424242424242', '12/30', '12', 'QA HOLDER', now)).not.toBeNull();
    expect(cardInputError('4242424242424242', '12/30', '123', 'QA HOLDER', now)).toBeNull();
  });
  it('does not honor sandbox or unverified legacy trials in production', () => {
    const trial = { status: 'TRIALING', source: 'TRIAL', paymentSource: { environment: 'sandbox', mandates: [{ verificationTransactionId: 'tx-test', verificationAmountCents: 150000 }] } };
    expect(trialAccessVerified(trial, true)).toBe(false);
    expect(trialAccessVerified({ ...trial, paymentSource: { environment: 'production', mandates: [] } }, true)).toBe(false);
    expect(trialAccessVerified({ ...trial, paymentSource: { ...trial.paymentSource, environment: 'production' } }, true)).toBe(true);
  });
});
