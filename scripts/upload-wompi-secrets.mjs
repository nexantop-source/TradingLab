/** Upload only TradingLab's Wompi credentials; never enables billing.
 * node scripts/upload-wompi-secrets.mjs          # local validation only
 * node scripts/upload-wompi-secrets.mjs --apply  # upload via authenticated Firebase CLI
 * Credentials travel through stdin, never shell arguments or console output.
 */
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = parseEnv(readFileSync(new URL('../.env.wompi.local', import.meta.url), 'utf8'));
const fields = [
  ['WOMPI_PUBLIC_KEY', 'pub_prod_'],
  ['WOMPI_INTEGRITY_SECRET', 'prod_integrity_'],
  ['WOMPI_EVENTS_SECRET', 'prod_events_'],
];

if (process.argv.slice(2).some((arg) => arg !== '--apply')) {
  throw new Error('Only --apply is supported. Without it, this script is read-only.');
}
if (config.WOMPI_ENVIRONMENT !== 'production' || config.BILLING_PROVIDER !== 'disabled') {
  throw new Error('Expected production credentials with BILLING_PROVIDER=disabled.');
}
for (const [key, prefix] of fields) {
  if (!new RegExp(`^${prefix}[A-Za-z0-9]+$`).test(config[key] ?? '')) {
    throw new Error(`Missing or invalid ${key}; no credentials uploaded.`);
  }
}
console.log('Three production credentials validated locally. Billing remains disabled.');
if (!process.argv.includes('--apply')) process.exit(0);

const common = ['--project', 'nexant-87204', '--account', 'nexantop@gmail.com', '--non-interactive'];
function firebase(args, input) {
  const result = spawnSync('npx', ['--yes', 'firebase-tools@15.24.0', ...args, ...common], {
    cwd: root,
    shell: process.platform === 'win32',
    input,
    encoding: 'utf8',
    timeout: 180_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  // Do not print raw CLI output: responses/errors may contain sensitive values.
  if (result.error || result.status !== 0) {
    throw new Error(`Firebase ${args[0]} failed (exit ${result.status ?? 'unavailable'}). Some earlier steps may have succeeded; billing was not enabled.`);
  }
}

for (const [key] of fields) {
  const secret = `TRADINGLAB_${key}`;
  firebase(['apphosting:secrets:set', secret, '--data-file', '-', '--force'], config[key]);
  console.log(`Uploaded ${secret}.`);
}
firebase([
  'apphosting:secrets:grantaccess',
  fields.map(([key]) => `TRADINGLAB_${key}`).join(','),
  '--backend', 'tradinglab',
]);
console.log('Access granted to tradinglab. This script does not rotate Wompi keys, set prices, change webhooks or enable billing.');
