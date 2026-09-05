// Read-only deployment status, deliberately excludes env values and credentials.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const config = JSON.parse(readFileSync(join(homedir(), '.config/configstore/firebase-tools.json'), 'utf8'));
const account = [config, ...(config.additionalAccounts ?? [])].find(item => item.user?.email === 'nexantop@gmail.com');
if (!account?.tokens?.access_token) throw new Error('Firebase CLI needs the nexantop@gmail.com session.');
const headers = { Authorization: `Bearer ${account.tokens.access_token}` };
const base = 'https://firebaseapphosting.googleapis.com/v1/';
const backendId = process.argv[2] ?? 'tradinglab';
if (!['tradinglab', 'nexant'].includes(backendId)) throw new Error('Unsupported backend');
const backend = `projects/nexant-87204/locations/us-east4/backends/${backendId}`;
async function get(path) {
  const response = await fetch(base + path, { headers, redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(`Firebase status request failed: HTTP ${response.status}, ${detail.error?.message ?? 'no detail'}`);
  }
  return response.json();
}
async function latestRollouts() {
  const items = [];
  let token;
  do {
    const page = await get(`${backend}/rollouts?pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`);
    items.push(...(page.rollouts ?? []));
    token = page.nextPageToken;
  } while (token);
  return items.sort((a, b) => (b.createTime ?? '').localeCompare(a.createTime ?? '')).slice(0, 3);
}
const [rollouts, traffic] = await Promise.all([
  latestRollouts(),
  get(`${backend}/traffic`),
]);
const buildNames = new Set([rollouts[0]?.build, ...(traffic.current?.splits ?? []).map(item => item.build)].filter(Boolean));
const builds = await Promise.all([...buildNames].map(name => get(name)));
console.log(JSON.stringify({
  rollouts: rollouts.map(item => ({ name: item.name, state: item.state, build: item.build, createTime: item.createTime, errorCode: item.error?.code })),
  builds: builds.map(item => ({ name: item.name, state: item.state, createTime: item.createTime, source: item.source?.codebase?.hash, errorCode: item.error?.code, buildLogsUri: item.buildLogsUri })),
  traffic: { current: traffic.current, reconciling: traffic.reconciling },
}, null, 2));
