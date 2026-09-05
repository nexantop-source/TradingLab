// Production admission smoke test. No transaction, charge, token or user is created.
// A synthetic non-transaction notification is ignored after signature validation.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
const config = parseEnv(readFileSync(new URL('../.env.wompi.local', import.meta.url), 'utf8'));
const secret = config.WOMPI_EVENTS_SECRET;
if (!secret?.startsWith('prod_events_')) throw new Error('Production events secret required; no requests sent.');
const origin = 'https://tradinglab--nexant-87204.us-east4.hosted.app';
const timestamp = Math.floor(Date.now() / 1000);
const id = 'integration_admission_check_no_payment';
const checksum = createHash('sha256').update(id + timestamp + secret).digest('hex');
const payload = { event: 'nequi_token.updated', environment: 'prod',
  data: { nequi_token: { id } }, timestamp, sent_at: new Date().toISOString(),
  signature: { properties: ['nequi_token.id'], checksum } };
let passed = true;
for (const url of [origin + '/api/payments/wompi/events', 'https://nexantcorp.com/api/billing/webhooks/wompi']) {
  for (const valid of [false, true]) {
    const event = valid ? payload : { ...payload, signature: { ...payload.signature, checksum: '0'.repeat(64) } };
    try {
      const response = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', 'X-Event-Checksum': event.signature.checksum }, body: JSON.stringify(event) });
      const body = await response.json().catch(() => ({}));
      const data = body.data ?? body;
      const success = valid ? response.status === 200 && data.received === true && data.ignored === true : response.status === 401;
      passed &&= success;
      console.log(JSON.stringify({ url, check: valid ? 'signed_non_transaction_ignored' : 'invalid_signature_rejected', status: response.status, passed: success }));
    } catch { passed = false; console.log(JSON.stringify({ url, check: 'network_failed', passed: false })); }
  }
}
const status = await fetch(origin + '/api/payments/wompi/events', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
const body = await status.json().catch(() => ({}));
console.log(JSON.stringify({ check: 'hub_configuration', status: status.status, checkoutEnabled: body.data?.checkoutEnabled }));
process.exitCode = passed && status.ok ? 0 : 1;
