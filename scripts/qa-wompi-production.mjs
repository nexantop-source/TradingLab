/** Production configuration/admission QA. Never creates users, tokens or transactions. */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const project = 'nexant-87204';
const origin = 'https://tradinglab--nexant-87204.us-east4.hosted.app';
const cli = JSON.parse(readFileSync(join(homedir(), '.config/configstore/firebase-tools.json'), 'utf8'));
const account = [cli, ...(cli.additionalAccounts ?? [])].find(a => a.user?.email === 'nexantop@gmail.com');
if (!account?.tokens?.access_token) throw Error('Refresh the existing Firebase CLI session first.');
const headers = { Authorization: `Bearer ${account.tokens.access_token}` };
let passed = true;
function check(name, success, details = {}) { passed &&= success; console.log(JSON.stringify({ check: name, passed: success, ...details })); }
async function cloud(url) {
  const r = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw Error(`Cloud read failed: HTTP ${r.status}`);
  return r.json();
}
const service = await cloud(`https://run.googleapis.com/v2/projects/${project}/locations/us-east4/services/tradinglab`);
const env = service.template.containers[0].env;
const value = name => env.find(e => e.name === name)?.value;
check('production_runtime', value('BILLING_PROVIDER') === 'wompi' && value('WOMPI_ENVIRONMENT') === 'production' && value('NEXT_PUBLIC_APP_URL') === origin);
async function secret(name) {
  const ref = env.find(e => e.name === name)?.valueSource?.secretKeyRef;
  if (!ref) throw Error(`Missing secret reference: ${name}`);
  const b = await cloud(`https://secretmanager.googleapis.com/v1/${ref.secret}/versions/${ref.version}:access`);
  return Buffer.from(b.payload.data, 'base64').toString('utf8').trim();
}
const secrets = {};
for (const [name, prefix] of [['WOMPI_PUBLIC_KEY','pub_prod_'],['WOMPI_PRIVATE_KEY','prv_prod_'],['WOMPI_INTEGRITY_SECRET','prod_integrity_'],['WOMPI_EVENTS_SECRET','prod_events_']]) {
  secrets[name] = await secret(name); check(`${name}_production`, secrets[name].startsWith(prefix));
}
const jobs = (await cloud(`https://cloudscheduler.googleapis.com/v1/projects/${project}/locations/us-east4/jobs`)).jobs ?? [];
const chargeJobs = jobs.filter(j => j.httpTarget?.uri === `${origin}/api/billing/charge-due` && j.state === 'ENABLED');
const dispatchSecret = await secret('PUSH_DISPATCH_SECRET');
check('single_active_charge_scheduler', chargeJobs.length === 1, { activeJobs: chargeJobs.map(j => j.name.split('/').pop()) });
check('scheduler_auth_matches_runtime', chargeJobs.length > 0 && chargeJobs.every(j => Object.entries(j.httpTarget.headers ?? {}).some(([k,v]) => k.toLowerCase() === 'authorization' && v === `Bearer ${dispatchSecret}`)));
check('scheduler_last_attempt', chargeJobs.length > 0 && chargeJobs.every(j => j.lastAttemptTime && !j.status?.code), { lastAttempts: chargeJobs.map(j => j.lastAttemptTime) });
const merchant = await fetch(`https://production.wompi.co/v1/merchants/${encodeURIComponent(secrets.WOMPI_PUBLIC_KEY)}`, { redirect: 'error', signal: AbortSignal.timeout(20000) });
const m = await merchant.json();
check('wompi_live_merchant_acceptance', merchant.ok && Boolean(m.data?.presigned_acceptance?.acceptance_token) && Boolean(m.data?.presigned_personal_data_auth?.acceptance_token), { status: merchant.status });
for (const path of ['/precios','/entrar','/crear-cuenta','/api/payments/wompi/events']) {
  const r = await fetch(origin + path, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  check(`public${path}`, r.ok, { status: r.status });
  if (path === '/precios') { const html = await r.text(); check('deployed_pricing_redesign', html.includes('plans-redesign') && html.includes('5.99') && html.includes('19.99')); }
}
const timestamp = Math.floor(Date.now()/1000), id = 'integration_admission_check_no_payment';
const checksum = createHash('sha256').update(id + timestamp + secrets.WOMPI_EVENTS_SECRET).digest('hex');
for (const valid of [false,true]) {
  const payload = { event:'nequi_token.updated', environment:'prod', data:{nequi_token:{id}}, timestamp, sent_at:new Date().toISOString(), signature:{properties:['nequi_token.id'],checksum:valid?checksum:'0'.repeat(64)} };
  const r = await fetch(origin+'/api/payments/wompi/events', {method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json','X-Event-Checksum':payload.signature.checksum},body:JSON.stringify(payload)});
  const b = await r.json(); check(valid?'signed_non_transaction_ignored':'invalid_signature_rejected', valid ? r.status===200 && b.data?.ignored===true : r.status===401, {status:r.status});
}
console.log(JSON.stringify({ passed, realCharges:0, transactionsCreated:0, note:'Does not prove issuer approval, actual Wompi delivery, or renewal settlement.' }));
process.exitCode = passed ? 0 : 1;
