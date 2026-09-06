/* Diagnostic-only: isolated QA data, local TLS, full React development diffs. */
const assert = require('node:assert/strict');
const { existsSync, realpathSync, readdirSync, readFileSync } = require('node:fs');
const { resolve, isAbsolute, dirname, basename } = require('node:path');
const { tmpdir } = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = 'https://127.0.0.1:3443';
const requestedDatabase = process.env.PWA_QA_PROBE_DATABASE;
assert(requestedDatabase && isAbsolute(requestedDatabase) && existsSync(requestedDatabase), 'PWA_QA_PROBE_DATABASE must name an absolute existing isolated fixture database');
const database = realpathSync(requestedDatabase);
const caseKey = path => process.platform === 'win32' ? path.toLowerCase() : path;
assert(caseKey(dirname(dirname(database))) === caseKey(realpathSync(tmpdir())) &&
  /^tradinglab-native-checkout-[A-Za-z0-9]+$/.test(basename(dirname(database))) && basename(database) === 'qa.db',
  'Probe database must resolve inside os.tmpdir()/tradinglab-native-checkout-*/qa.db; refusing any other database');
const production = process.env.PWA_QA_PROBE_PRODUCTION === '1';
const env = { ...process.env, DATABASE_URL: `file:${database.replaceAll('\\', '/')}`, DATABASE_PROVIDER: 'sqlite',
  NODE_ENV: production ? 'production' : 'development', NEXT_PUBLIC_APP_URL: BASE, AUTH_SECRET: 'QA_LOCAL_SYNTHETIC_SESSION_SECRET_NOT_FOR_REAL_USE',
  BILLING_PROVIDER: 'wompi', WOMPI_ENVIRONMENT: 'production', WOMPI_EVENT_HUB_ENABLED: 'true',
  WOMPI_PUBLIC_KEY: 'pub_prod_LOCAL_FIXTURE', WOMPI_PRIVATE_KEY: '', WOMPI_EVENTS_SECRET: 'prod_events_LOCAL_FIXTURE',
  WOMPI_INTEGRITY_SECRET: 'prod_integrity_LOCAL_FIXTURE', NEXT_PUBLIC_GOOGLE_ADS_ENABLED: 'false', CHECKPOINT_DISABLE: '1',
};
const children = [];
function start(file, args, extra = {}) {
  const child = spawn(process.execPath, [file, ...args], { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  children.push(child);
  child.stdout.on('data', data => process.stdout.write(data));
  child.stderr.on('data', data => process.stderr.write(data));
  return child;
}
(async () => {
  let browser;
  const errors = [];
  try {
    const server = start(resolve('node_modules/next/dist/bin/next'), [production ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', '3010'],
      { NODE_OPTIONS: `--require "${resolve('scripts/qa-local-network.cjs').replaceAll('\\', '/')}"` });
    start(resolve('scripts/qa-pwa-https.cjs'), []);
    await new Promise((done, reject) => {
      const timer = setTimeout(() => reject(Error('Dev startup timeout')), 45000);
      server.stdout.on('data', data => { if (data.toString().includes('Ready')) { clearTimeout(timer); done(); } });
      server.on('exit', code => { clearTimeout(timer); reject(Error(`Dev exited ${code}`)); });
    });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      ignoreHTTPSErrors: true, locale: 'es-CO', colorScheme: 'dark', serviceWorkers: 'block' });
    await context.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); localStorage.setItem('tl-app-orientation:v1', 'seen'); });
    await require('./qa-hydration-recovery.cjs')(context);
    await context.route('**/*', route => new URL(route.request().url()).origin === BASE ? route.continue() : route.abort());
    if (production && process.env.PWA_QA_PROBE_NODE_DIAG === '1') await require('./qa-hydration-node.cjs')(context);
    const themeDelay = Number(process.env.PWA_QA_PROBE_THEME_DELAY_MS || '0');
    assert(Number.isInteger(themeDelay) && themeDelay >= 0 && themeDelay <= 1000, 'Theme chunk stress delay must be 0..1000 ms');
    if (production && themeDelay) {
      const directory = resolve('.next/static/chunks');
      const filename = readdirSync(directory).find(file => file.endsWith('.js') &&
        /THEME_OPTIONS/.test(readFileSync(resolve(directory, file), 'utf8')) &&
        /ThemeProvider/.test(readFileSync(resolve(directory, file), 'utf8')));
      assert(filename, 'Cannot find the built ThemeProvider chunk for a causal stress test');
      await context.route(`${BASE}/_next/static/chunks/${filename}`, async route => {
        await new Promise(done => setTimeout(done, themeDelay));
        await route.continue();
      });
      console.log('PROBE_THEME_CHUNK_DELAY', filename, themeDelay);
    }
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => { errors.push({ path: page.url(), error: error.message, stack: error.stack }); console.error('PROBE_PAGEERROR', page.url(), error.message, error.stack); });
    page.on('console', message => { if (message.type() === 'error') console.error('PROBE_CONSOLE_ERROR', page.url(), message.text()); });
    async function visit(path) {
      const response = await page.goto(BASE + path, { waitUntil: 'networkidle' });
      if (errors.length) throw Error('Hydration probe captured an error; inspect the full diff above');
      if (process.env.PWA_QA_PROBE_VERIFY_BOOTSTRAP === '1') {
        const html = await response.text();
        const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1];
        assert(head?.includes("var choice = localStorage.getItem('tl-theme')"), `Expected early literal theme script in head: ${path}`);
        assert(!html.includes('THEME_INIT_SCRIPT'), `Theme bootstrap must not be a Flight client-module reference: ${path}`);
        assert.equal(await page.locator('body > a.skip-link[href="#contenido"]').count(), 1, 'Accessible skip link remains in SSR body');
      }
    }
    for (let cycle = 0; cycle < (production ? 8 : 3); cycle++) {
      for (const path of ['/entrar', '/precios', '/app']) {
        console.log('PROBE_NAV', cycle, path);
        await visit(path);
      }
    }
    await page.goto(BASE + '/entrar', { waitUntil: 'networkidle' });
    await page.locator('#email').fill('native-qa-chromium@example.invalid');
    await page.locator('#password').fill('Local-only-QA-2026!');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL('**/panel');
    for (let cycle = 0; cycle < (production ? 8 : 4); cycle++) {
      for (const path of ['/perfil', '/precios', '/panel']) {
        console.log('PROBE_NAV_AUTH', cycle, path);
        await visit(path);
      }
    }
    console.log('PROBE_FINISHED', JSON.stringify({ errors }));
  } finally {
    await browser?.close();
    for (const child of children) if (child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
