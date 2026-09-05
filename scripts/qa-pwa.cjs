/* Isolated, signed-out Chromium. Never opens a personal Chrome profile. Local QA only. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = 'http://127.0.0.1:3010';
const output = process.env.PWA_QA_OUTPUT;
if (!output || !path.isAbsolute(output)) throw new Error('PWA_QA_OUTPUT must name an existing absolute output directory.');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  let phase = 'welcome';
  const results = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'es-CO' });
  // No external pages, ads, payment gateways, profiles or user credentials in this test.
  await context.route('**/*', route => new URL(route.request().url()).origin === BASE ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', error => { errors.push(`${phase}: ${page.url()}: ${error.message}`); console.error('Browser error:', phase, page.url(), error.message); });
  const fits = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
  try {
    await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /El mercado cambia/ }).waitFor();
    await fits();
    await page.screenshot({ path: path.join(output, 'pwa-welcome-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await page.getByRole('heading', { name: /Practica sin poner/ }).waitFor();
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    assert(await page.getByRole('button', { name: 'Siguiente', exact: true }).isDisabled());
    await page.getByRole('button', { name: /Pantalla 1:/ }).click();
    assert(await page.getByRole('button', { name: 'Anterior', exact: true }).isDisabled());
    results.push('welcome: carousel bounds, keyboard-accessible controls, mobile layout');
    phase = 'service worker reload';
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload({ waitUntil: 'networkidle' });
    const cachePaths = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)))).flat());
    assert.deepEqual(cachePaths, ['/offline.html']);
    phase = 'icon endpoints';
    for (const size of [180, 192, 512]) {
      const icon = await context.request.get(`${BASE}/app-icon/${size}`);
      assert.equal(icon.status(), 200);
      const bytes = await icon.body();
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size);
    }
    assert.equal((await context.request.get(`${BASE}/app-icon/999`)).status(), 404);
    results.push('PWA: public-only cache and real PNG icon dimensions');
    phase = 'desktop welcome';
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(output, 'pwa-welcome-desktop.png'), fullPage: true, animations: 'disabled' });
    phase = 'login';
    await page.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(output, 'pwa-login-desktop.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel(/^Contraseña/).fill('Local QA password only');
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    assert.equal(await page.locator('#password').getAttribute('type'), 'text');
    await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
    assert.equal(await page.locator('#password').inputValue(), 'Local QA password only');
    await page.locator('#password').fill('');
    await fits();
    await page.screenshot({ path: path.join(output, 'pwa-login-mobile.png'), fullPage: true, animations: 'disabled' });
    phase = 'register';
    await page.goto(`${BASE}/crear-cuenta`, { waitUntil: 'networkidle' });
    await fits();
    assert.equal(await page.locator('input[type=checkbox]:checked').count(), 0);
    assert.equal(await page.locator('input[type=checkbox][required]').count(), 3);
    await page.screenshot({ path: path.join(output, 'pwa-register-mobile.png'), fullPage: true, animations: 'disabled' });
    results.push('auth: visible labels, password toggle, consent opt-in, mobile layout');
    if (process.env.PWA_QA_REGISTER === '1') {
      const email = `pwa-qa-${Date.now()}@example.invalid`;
      console.log(`Local QA account: ${email}`);
      await page.locator('#name').fill('PWA QA'); await page.locator('#email').fill(email);
      await page.locator('#password').fill('Local-only-QA-2026!');
      await page.locator('#countryCode').selectOption('CO');
      for (const name of ['confirmAge', 'acceptTerms', 'acceptRisk']) await page.locator(`input[name="${name}"]`).check();
      await page.getByRole('button', { name: 'Crear mi cuenta DEMO' }).click();
      await page.waitForURL('**/onboarding');
      await page.getByRole('button', { name: 'Empezar', exact: true }).waitFor();
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.onboarding-stage')).opacity) > .999);
      await page.screenshot({ path: path.join(output, 'pwa-onboarding-mobile.png'), fullPage: true, animations: 'disabled' });
      await fits();
      await page.getByRole('button', { name: 'Empezar', exact: true }).click();
      await page.getByRole('button', { name: /^ETF/ }).click();
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      for (let i = 0; i < 12; i++) {
        const legend = await page.locator('fieldset legend').innerText();
        await page.locator('fieldset button').last().click();
        if (await page.getByRole('button', { name: 'Ver mi resultado' }).count()) break;
        const next = page.getByRole('button', { name: 'Siguiente', exact: true });
        // Supports explicit progression; old versions advanced automatically.
        await next.click();
        await page.waitForFunction(previous => document.querySelector('fieldset legend')?.textContent !== previous, legend);
      }
      await page.getByRole('button', { name: 'Ver mi resultado' }).click();
      await page.getByRole('heading', { name: 'Repaso de tus respuestas' }).waitFor();
      await page.getByRole('button', { name: 'Ir al panel' }).click();
      await page.waitForURL('**/panel');
      await page.waitForLoadState('networkidle');
      await fits();
      await page.screenshot({ path: path.join(output, 'pwa-panel-mobile.png'), fullPage: true, animations: 'disabled' });
      await page.goto(`${BASE}/app`); await page.waitForURL('**/panel');
      results.push(`local signup + full assessment + account entry redirect: ${email}`);
    }
    phase = 'offline';
    await context.setOffline(true);
    await page.goto(`${BASE}/app`);
    assert.match(await page.locator('body').innerText(), /Necesitas conexión|necesitas conexión|conexión/i);
    assert.equal(await page.locator('input').count(), 0);
    await page.screenshot({ path: path.join(output, 'pwa-offline.png'), fullPage: true });
    await context.setOffline(false);
    phase = 'reduced motion';
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // New signed-out page, so reduced-motion welcome also works after signup.
    await context.clearCookies();
    await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.market-art-core').evaluate(element => getComputedStyle(element).transform), 'none');
    results.push('offline: no account form/data; reduced-motion artwork disabled');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: results, pageErrors: errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
