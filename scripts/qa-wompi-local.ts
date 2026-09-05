/** Real SQLite + real route/provider code, fabricated credentials, zero external network.
 * node --conditions=react-server --import tsx scripts/qa-wompi-local.ts
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'tradinglab-wompi-qa-'));
  const empty = new DatabaseSync(join(directory, 'isolated.db'));
  empty.exec('PRAGMA user_version = 0');
  empty.close();
  Object.assign(process.env, {
    DATABASE_URL: `file:${join(directory, 'isolated.db').replaceAll('\\', '/')}`,
    WOMPI_ENVIRONMENT: 'production', WOMPI_EVENT_HUB_ENABLED: 'true', BILLING_PROVIDER: 'wompi',
    WOMPI_PUBLIC_KEY: 'pub_prod_LOCAL_FIXTURE', WOMPI_PRIVATE_KEY: '',
    WOMPI_EVENTS_SECRET: 'prod_events_LOCAL_FIXTURE', WOMPI_INTEGRITY_SECRET: 'prod_integrity_LOCAL_FIXTURE',
    WOMPI_PRICING_MODE: 'fixed_cop', WOMPI_STANDARD_MONTHLY_AMOUNT_IN_CENTS: '5990000',
    NEXT_PUBLIC_APP_URL: 'https://local-fixture.invalid',
  });
  const init = spawnSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate'], { env: process.env, encoding: 'utf8' });
  assert.equal(init.status, 0, `isolated database initialization failed: ${init.stderr} ${init.stdout}`);
  const { db } = await import('../src/lib/db');
  try {
    const { WompiBillingProvider } = await import('../src/lib/wompi');
    const { POST } = await import('../src/app/api/payments/wompi/events/route');
    const { NextRequest } = await import('next/server');
    await db.plan.create({ data: { id: 'STANDARD', name: 'QA only', priceMonthlyCents: 1499, priceYearlyCents: 14900 } });
    const user = await db.user.create({ data: { email: 'wompi-local-only@example.invalid', passwordHash: 'NO_LOGIN', name: 'Isolated QA' } });
    const provider = new WompiBillingProvider();
    const params = { userId: user.id, email: user.email, planId: 'STANDARD' as const, interval: 'MONTHLY' as const, idempotencyKey: 'isolated-checkout-00001' };
    const checkout = await provider.createCheckout(params);
    assert.equal(checkout.status, 'REDIRECT');
    assert.equal((await provider.createCheckout(params)).paymentId, checkout.paymentId);
    assert.equal(await db.payment.count(), 1);
    assert.equal(await db.subscription.count(), 0);
    assert.equal(new URL(checkout.redirectUrl!).searchParams.get('amount-in-cents'), '5990000');
    let transaction = { id: 'local_tx_000001', status: 'APPROVED', amount_in_cents: 5990000, currency: 'COP', reference: checkout.reference! };
    let forwardingFails = false;
    let forwards = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url === `https://production.wompi.co/v1/transactions/${transaction.id}`) return Response.json({ data: transaction });
      if (url === 'https://nexantcorp.com/api/billing/webhooks/wompi') {
        forwards++;
        return Response.json({ received: !forwardingFails }, { status: forwardingFails ? 503 : 200 });
      }
      throw new Error('NETWORK_BLOCKED_IN_LOCAL_QA');
    };
    const notify = async (wrongSignature = false) => {
      const timestamp = 1788640000;
      const checksum = createHash('sha256').update(transaction.id + transaction.status + transaction.amount_in_cents + timestamp + process.env.WOMPI_EVENTS_SECRET).digest('hex');
      return POST(new NextRequest('https://local-fixture.invalid/api/payments/wompi/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          event: 'transaction.updated', environment: 'prod', data: { transaction }, timestamp, sent_at: '2026-09-05T23:00:00Z',
          signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum: wrongSignature ? '0'.repeat(64) : checksum },
        }),
      }));
    };
    assert.equal((await notify(true)).status, 401);
    assert.equal(await db.webhookEvent.count(), 0);
    assert.equal((await notify()).status, 200);
    assert.equal((await db.payment.findUniqueOrThrow({ where: { id: checkout.paymentId } })).status, 'SUCCEEDED');
    const subscription = await db.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    assert.equal(subscription.status, 'ACTIVE');
    assert.equal((await notify()).status, 200);
    assert.equal((await db.subscription.findUniqueOrThrow({ where: { userId: user.id } })).currentPeriodEnd.toISOString(), subscription.currentPeriodEnd.toISOString());
    await assert.rejects(provider.createCheckout({ ...params, idempotencyKey: 'another-new-checkout' }));
    transaction = { ...transaction, id: 'local_tx_nexant_001', reference: 'product_abcdefghijklmno' };
    forwardingFails = true;
    assert.equal((await notify()).status, 500);
    assert.equal(await db.webhookEvent.count({ where: { processedAt: null } }), 1);
    forwardingFails = false;
    assert.equal((await notify()).status, 200);
    assert.equal(await db.webhookEvent.count({ where: { processedAt: null } }), 0);
    assert.equal((await notify()).status, 200);
    assert.equal(forwards, 2);
    assert.equal(await db.payment.count(), 1);
    console.log(JSON.stringify({ passed: true, isolatedDatabase: directory, checks: ['checkout_idempotency', 'pending_no_access', 'invalid_signature', 'approved_activates_once', 'active_plan_blocks_duplicate_charge', 'nexant_failure_persisted', 'retry_recovers', 'projects_isolated'], externalRequests: 0, realCharges: 0 }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error('Isolated Wompi integration QA failed:', error instanceof Error ? error.message : 'unknown error'); process.exitCode = 1; });
