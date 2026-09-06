/* Production UI + real billing route/provider, local TLS, isolated SQLite,
 * fabricated Wompi keys, no real checkout navigation or customer accounts.
 * Build first. Ports 3010/3443 must be free. Node 22+ and OpenSSL required.
 */
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, isAbsolute } = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const engines = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = 'https://127.0.0.1:3443';
const output = process.env.PWA_QA_OUTPUT;
if (!output || !isAbsolute(output)) throw Error('Set an absolute PWA_QA_OUTPUT directory');

(async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tradinglab-native-checkout-'));
  const filename = join(directory, 'qa.db');
  new DatabaseSync(filename).close();
  const databaseUrl = `file:${filename.replaceAll('\\', '/')}`;
  const env = { ...process.env, DATABASE_URL: databaseUrl, DATABASE_PROVIDER: 'sqlite', NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: BASE, AUTH_SECRET: 'QA_LOCAL_SYNTHETIC_SESSION_SECRET_NOT_FOR_REAL_USE',
    BILLING_PROVIDER: 'wompi', WOMPI_ENVIRONMENT: 'production', WOMPI_EVENT_HUB_ENABLED: 'true',
    WOMPI_PUBLIC_KEY: 'pub_prod_LOCAL_FIXTURE', WOMPI_PRIVATE_KEY: '', WOMPI_EVENTS_SECRET: 'prod_events_LOCAL_FIXTURE',
    WOMPI_INTEGRITY_SECRET: 'prod_integrity_LOCAL_FIXTURE', WOMPI_PRICING_MODE: 'fixed_cop',
    WOMPI_STANDARD_MONTHLY_AMOUNT_IN_CENTS: '5990000', WOMPI_STANDARD_YEARLY_AMOUNT_IN_CENTS: '59900000',
    WOMPI_PREMIUM_MONTHLY_AMOUNT_IN_CENTS: '11990000', WOMPI_PREMIUM_YEARLY_AMOUNT_IN_CENTS: '119900000',
    NEXT_PUBLIC_GOOGLE_ADS_ENABLED: 'false', CHECKPOINT_DISABLE: '1',
    MARKET_DATA_PROVIDER: process.env.PWA_QA_REAL_FEED === '1' ? 'binance' : 'synthetic',
    REQUIRE_REAL_MARKET_DATA: process.env.PWA_QA_REAL_FEED === '1' ? 'true' : 'false',
  };
  const schema = spawnSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate'], { env, encoding: 'utf8' });
  assert.equal(schema.status, 0, schema.stderr);
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  let server, tls;
  try {
    for (const [id, name] of [['FREE', 'Explore'], ['STANDARD', 'Plus'], ['PREMIUM', 'Pro']]) await db.plan.create({ data: { id, name, priceMonthlyCents: 0, priceYearlyCents: 0 } });
    for (const engine of ['chromium', 'webkit']) await db.user.create({ data: { email: `native-qa-${engine}@example.invalid`, name: 'María Demo', passwordHash: await bcrypt.hash('Local-only-QA-2026!', 12), onboardingCompleted: true, profile: { create: { theme: 'dark' } } } });
    const start = (file, args, extra = {}) => spawn(process.execPath, [file, ...args], { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    server = start(resolve('node_modules/next/dist/bin/next'), ['start', '--hostname', '127.0.0.1', '--port', '3010'], { NODE_OPTIONS: `--require "${resolve('scripts/qa-local-network.cjs').replaceAll('\\', '/')}"` });
    tls = start(resolve('scripts/qa-pwa-https.cjs'), []);
    for (const child of [server, tls]) child.stderr.on('data', chunk => process.stderr.write(chunk));
    await new Promise((resolveReady, reject) => {
      const timeout = setTimeout(() => reject(Error('Local Next server startup timed out')), 25000);
      server.stdout.on('data', chunk => { if (chunk.toString().includes('Ready')) { clearTimeout(timeout); resolveReady(); } });
      server.on('exit', code => { clearTimeout(timeout); reject(Error(`Local server exited ${code}`)); });
    });
    mkdirSync(output, { recursive: true });
    const results = [];
    for (const engine of ['chromium', 'webkit']) {
      const browser = await engines[engine].launch({ headless: true });
      try {
        // SW has a separate privacy/offline suite. Block it here so Playwright
        // can intercept every request for the intentional Origin rejection.
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true, locale: 'es-CO', colorScheme: 'dark', serviceWorkers: 'block' });
        await context.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
        await context.route('**/*', route => new URL(route.request().url()).origin === BASE ? route.continue() : route.abort());
        // Fulfill checkout navigation entirely in Playwright. No Wompi request
        // ever leaves this fixture; only fabricated local intents are tested.
        await context.route('https://checkout.wompi.co/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Isolated checkout navigation</h1>' }));
        const page = await context.newPage();
        if (engine === 'chromium' && process.env.PWA_QA_HYDRATION_DIAG === '1') await require('./qa-hydration-diagnostics.cjs')(page);
        const errors = [];
        const nativeChecks = [];
        page.on('pageerror', e => { errors.push(e.message); console.error('Browser error', new URL(page.url()).pathname, e.message); });
        const screenshot = async name => { await page.evaluate(() => scrollTo(0, 0)); return page.screenshot({ path: join(output, `${engine}-${name}.png`), fullPage: true, animations: 'disabled' }); };
        const fits = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
        if (process.env.PWA_QA_NATIVE_TRADING === '1') nativeChecks.push(await require('./qa-welcome-scenes.cjs')(page, engine, BASE, output));
        await page.goto(BASE + '/entrar', { waitUntil: 'networkidle' });
        await page.locator('#email').fill(`native-qa-${engine}@example.invalid`);
        await page.locator('#password').fill('Local-only-QA-2026!');
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await page.waitForURL('**/panel');
        const tour = page.getByRole('dialog');
        await tour.waitFor();
        await screenshot('onboarding-01');
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'orientation-title');
        await tour.getByRole('button', { name: 'Continuar', exact: true }).click();
        await tour.getByRole('heading', { name: /Ideas reales/ }).waitFor();
        await screenshot('onboarding-02');
        await tour.getByRole('button', { name: 'Paso anterior' }).click();
        await tour.getByRole('heading', { name: /Primero/ }).waitFor();
        await tour.getByRole('button', { name: 'Omitir' }).click();
        assert(!(await tour.isVisible()));
        await page.reload({ waitUntil: 'networkidle' });
        assert(!(await tour.isVisible()), 'Tour must not repeat after dismissal');
        assert(!(await page.locator('.dashboard-browser-body').isVisible()));
        await page.getByRole('heading', { name: /Tu siguiente idea/ }).waitFor();
        assert(await page.getByText('Explore incluido', { exact: true }).isVisible());
        await fits(); await screenshot('home-dark');
        await page.getByRole('button', { name: 'Conoce tu app' }).click();
        await tour.waitFor();
        await tour.getByRole('button', { name: 'Continuar', exact: true }).click();
        await tour.getByRole('button', { name: 'Continuar', exact: true }).click();
        await screenshot('onboarding-03');
        assert.equal(await tour.getByRole('link', { name: 'Empezar a aprender' }).getAttribute('href'), '/academia');
        await tour.getByRole('button', { name: 'Explorar mi inicio' }).click();
        assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Conoce tu app');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.getByRole('button', { name: 'Conoce tu app' }).click();
        assert.equal(await page.locator('.native-orientation .layer-front').evaluate(node => getComputedStyle(node).transitionDuration), '0s');
        await page.keyboard.press('Escape');
        assert(!(await tour.isVisible()));
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        for (const width of [320, 430]) { await page.setViewportSize({ width, height: 844 }); await fits(); }
        await page.setViewportSize({ width: 390, height: 844 });
        if (process.env.PWA_QA_NATIVE_TRADING === '1') {
          nativeChecks.push(await require('./qa-native-gestures.cjs')(page, engine));
          nativeChecks.push(await require(process.env.PWA_QA_REAL_FEED === '1' ? './qa-real-practice.cjs' : './qa-simple-terminal.cjs')(page, engine, BASE, output));
        }
        await page.goto(BASE + '/perfil', { waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: 'María Demo', exact: true }).waitFor();
        await screenshot('account-dark');
        await page.getByRole('button', { name: /Mi suscripción/ }).click();
        await page.getByRole('heading', { name: 'Mi suscripción', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Mi cuenta', exact: true }).click();
        await page.evaluate(() => localStorage.setItem('tl-theme', 'dark'));
        await page.goto(BASE + '/precios', { waitUntil: 'networkidle' });
        await page.locator('.native-plans').waitFor();
        assert(!(await page.locator('.browser-pricing-page').isVisible()));
        assert.equal(await page.getByRole('radio').count(), 2, 'Only paid plans can be selected');
        assert.equal(await page.getByRole('radio', { name: /Explore/ }).count(), 0);
        assert(await page.getByText('Explore está activo', { exact: true }).isVisible());
        await page.locator('.native-plan-option').filter({ has: page.getByRole('radio', { name: /Plus/ }) }).click();
        assert(await page.getByRole('radio', { name: /Plus/ }).isChecked());
        await fits(); await screenshot('plans-dark');
        await page.getByRole('button', { name: '1 año', exact: true }).click();
        assert.match(await page.getByRole('link', { name: /Continuar con Plus/ }).getAttribute('href'), /interval=YEARLY/);
        await page.getByRole('button', { name: '1 mes', exact: true }).click();
        await page.getByRole('link', { name: /Continuar con Plus/ }).click();
        await page.waitForURL('**/pago?plan=STANDARD&interval=MONTHLY');
        await page.getByRole('heading', { name: 'Plan Plus', exact: true }).waitFor();
        assert(!(await page.getByRole('navigation', { name: 'Navegación rápida' }).isVisible()));
        assert(await page.getByRole('link', { name: 'Volver a planes', exact: true }).first().isVisible());
        for (const width of [320, 390, 430]) { await page.setViewportSize({ width, height: 844 }); await fits(); }
        await page.setViewportSize({ width: 390, height: 844 });
        await screenshot('checkout-dark');
        let preparedBody;
        await page.route('**/api/billing/subscribe', async route => {
          const upstream = await route.fetch();
          preparedBody = await upstream.json();
          await route.fulfill({ response: upstream });
        }, { times: 1 });
        const response = page.waitForResponse(r => r.url() === BASE + '/api/billing/subscribe');
        await page.getByRole('button', { name: 'Pagar con Wompi' }).click();
        const preparedResponse = await response;
        assert.equal(preparedResponse.status(), 200);
        const prepared = preparedBody.data;
        assert.equal(prepared.status, 'REDIRECT'); assert.equal(prepared.currency, 'COP');
        assert.equal(prepared.amountInCents, 5990000); assert(prepared.reference); assert(prepared.paymentId);
        const link = new URL(prepared.redirectUrl);
        assert.equal(link.origin, 'https://checkout.wompi.co');
        assert.equal(link.searchParams.get('amount-in-cents'), '5990000');
        await page.waitForURL('https://checkout.wompi.co/**');
        await page.getByRole('heading', { name: 'Isolated checkout navigation' }).waitFor();
        assert.equal(page.url(), prepared.redirectUrl);
        await page.goto(BASE + '/pago?plan=STANDARD&interval=MONTHLY', { waitUntil: 'networkidle' });
        const key = await page.evaluate(() => sessionStorage.getItem('tl-checkout:STANDARD:MONTHLY'));
        const replay = await context.request.post(BASE + '/api/billing/subscribe', { headers: { Origin: BASE, 'Sec-Fetch-Site': 'same-origin' }, data: { planId: 'STANDARD', interval: 'MONTHLY', idempotencyKey: key } });
        assert.equal(replay.status(), 200);
        assert.equal((await replay.json()).data.paymentId, prepared.paymentId);
        for (const endpoint of ['/api/billing/subscribe', '/api/billing/cancel']) {
          const rejected = await context.request.post(BASE + endpoint, { headers: { Origin: 'https://untrusted.example.invalid', 'Sec-Fetch-Site': 'same-origin' }, data: {} });
          assert.equal(rejected.status(), 403);
        }
        await page.evaluate(() => localStorage.setItem('tl-theme', 'light'));
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: 'Plan Plus', exact: true }).waitFor();
        await screenshot('checkout-light');
        // Real foreign-Origin rejection is asserted above. Inject the same
        // response shape here to exercise error UI without browser header rules.
        await page.route('**/api/billing/subscribe', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'CROSS_SITE_REQUEST', message: 'Origen rechazado en la prueba local.' } }) }), { times: 1 });
        await page.getByRole('button', { name: 'Pagar con Wompi' }).click();
        await page.getByText('No pudimos preparar el pago', { exact: true }).waitFor();
        await screenshot('checkout-error-light');
        const [retried] = await Promise.all([page.waitForResponse(r => r.url() === BASE + '/api/billing/subscribe'), page.getByRole('button', { name: 'Reintentar pago seguro' }).click()]);
        assert.equal(retried.status(), 200);
        await page.waitForURL('https://checkout.wompi.co/**');
        await page.goto(BASE + '/billing', { waitUntil: 'networkidle' });
        await page.getByRole('heading', { name: 'Facturación', exact: true }).waitFor();
        assert((await page.locator('.billing-page').textContent()).includes(prepared.paymentId));
        await screenshot('billing-history');
        await page.goto(BASE + '/precios', { waitUntil: 'networkidle' });
        await page.getByRole('radio', { name: /Pro/ }).focus();
        await page.keyboard.press('Space');
        assert(await page.getByRole('radio', { name: /Pro/ }).isChecked());
        await screenshot('plans-light');
        await page.goto(BASE + '/panel', { waitUntil: 'networkidle' });
        assert(!(await tour.isVisible()));
        await screenshot('home-light');
        // Browser mode remains distinct, including mobile checkout's existing nav.
        await context.close();
        const normal = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true, serviceWorkers: 'block' });
        await normal.route('**/*', route => new URL(route.request().url()).origin === BASE ? route.continue() : route.abort());
        const web = await normal.newPage();
        await web.goto(BASE + '/precios', { waitUntil: 'networkidle' });
        await web.locator('.browser-pricing-page').waitFor();
        assert(!(await web.locator('.native-plans').isVisible()));
        assert.deepEqual(errors, []);
        results.push({ engine, passed: ['tour_focus_skip_persistence_replay', 'native_home', 'free_always_included_not_selectable', 'account_navigation', 'plan_selection_touch_and_keyboard', 'annual_intent', 'checkout_focus', '320_390_430_layout', 'real_subscribe_route_200_behind_proxy', 'COP_link_and_ID', 'idempotent_retry', 'foreign_origin_blocked', 'error_and_retry_UI', 'light_dark', 'normal_web_unchanged'], nativeChecks, pageErrors: errors });
      } finally { await browser.close(); }
    }
    assert.equal(await db.payment.count(), 2);
    assert.equal(await db.payment.count({ where: { status: 'PENDING', externalId: null } }), 2);
    assert.equal(await db.subscription.count(), 0);
    console.log(JSON.stringify({ results, realCharges: 0, subscriptionsActivated: 0, isolatedDatabase: directory }, null, 2));
  } finally {
    server?.kill(); tls?.kill(); await db.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
