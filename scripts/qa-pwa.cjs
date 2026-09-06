/* Isolated Chromium/WebKit. Never opens a personal Chrome profile. Local QA only. */
const assert = require('node:assert/strict');
const path = require('node:path');
const engines = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.PWA_QA_ENGINE === 'webkit' ? engines.webkit : engines.chromium;
const BASE = process.env.PWA_QA_HTTPS === '1' ? 'https://127.0.0.1:3443' : 'http://127.0.0.1:3010';
const output = process.env.PWA_QA_OUTPUT;
if (!output || !path.isAbsolute(output)) throw new Error('PWA_QA_OUTPUT must name an existing absolute output directory.');

(async () => {
  const browser = await engine.launch({ headless: true });
  const errors = [];
  let phase = 'welcome';
  const results = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'es-CO', ignoreHTTPSErrors: process.env.PWA_QA_HTTPS === '1' });
  const standalone = process.env.PWA_QA_STANDALONE === '1';
  if (standalone) await context.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
  // No external pages, ads, payment gateways, profiles or user credentials in this test.
  await context.route('**/*', route => new URL(route.request().url()).origin === BASE ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', error => { errors.push(`${phase}: ${page.url()}: ${error.message}`); console.error('Browser error:', phase, page.url(), error.message); });
  const fits = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
  try {
    if (!standalone) {
      await page.goto(BASE, { waitUntil: 'networkidle' });
      assert.equal(new URL(page.url()).pathname, '/');
      await page.locator('.marketing-nav-shell').waitFor({ state: 'visible' });
      assert(!(await page.locator('.native-public-header').isVisible()));
      results.push('normal mobile browser keeps the marketing website');
    }
    await page.goto(`${BASE}${standalone ? '/' : '/app'}`, { waitUntil: 'networkidle' });
    if (standalone) {
      await page.waitForURL('**/app');
      assert.equal(await page.locator('html').getAttribute('data-app-mode'), 'standalone');
      results.push('iOS standalone launch from legacy root reaches /app');
    }
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
    const reuseEmail = process.env.PWA_QA_REUSE_EMAIL;
    if (reuseEmail && !/^pwa-qa-\d+@example\.invalid$/.test(reuseEmail)) throw new Error('Only local synthetic QA accounts may be reused.');
    if (process.env.PWA_QA_REGISTER === '1' || reuseEmail) {
      const email = reuseEmail || `pwa-qa-${Date.now()}@example.invalid`;
      console.log(`Local QA account: ${email}`);
      if (reuseEmail) {
        await page.goto(`${BASE}/entrar`, { waitUntil: 'networkidle' });
        await page.locator('#email').fill(email);
        await page.locator('#password').fill('Local-only-QA-2026!');
        const response = page.waitForResponse(r => r.url() === `${BASE}/api/auth/login`);
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        assert.equal((await response).status(), 200, 'Local QA login failed');
      } else {
      await page.locator('#name').fill('PWA QA'); await page.locator('#email').fill(email);
      await page.locator('#password').fill('Local-only-QA-2026!');
      await page.locator('#countryCode').selectOption('CO');
      for (const name of ['confirmAge', 'acceptTerms', 'acceptRisk']) await page.locator(`input[name="${name}"]`).check();
      const response = page.waitForResponse(r => r.url() === `${BASE}/api/auth/register`);
      await page.getByRole('button', { name: 'Crear mi cuenta DEMO' }).click();
      assert((await response).ok(), 'Local signup failed (check rate limits); reuse a pending synthetic QA account instead.');
      }
      await page.waitForURL(/\/(onboarding|panel)$/);
      if (new URL(page.url()).pathname === '/onboarding') {
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
      }
      await page.waitForURL('**/panel');
      await page.waitForLoadState('networkidle');
      if (standalone) {
        const tour = page.locator('.native-orientation');
        if (await tour.isVisible()) await tour.getByRole('button', { name: 'Omitir' }).click();
      }
      await page.getByRole('heading', { name: standalone ? 'Un paso más claro.' : 'Todo tu espacio, de un vistazo.', exact: true }).waitFor();
      await fits();
      await page.screenshot({ path: path.join(output, 'pwa-panel-mobile.png'), fullPage: true, animations: 'disabled' });
      if (standalone) {
        assert(await page.getByRole('heading', { name: 'Un paso más claro.', exact: true }).isVisible());
        assert(!(await page.locator('.dashboard-browser-intro').isVisible()));
        await page.screenshot({ path: path.join(output, 'pwa-native-home.png'), animations: 'disabled' });
        for (const width of [320, 430]) { await page.setViewportSize({ width, height: 844 }); await fits(); }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
        assert(await page.getByRole('dialog', { name: 'Todas las secciones' }).isVisible());
        await page.screenshot({ path: path.join(output, 'pwa-native-menu.png'), animations: 'disabled' });
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('dialog', { name: 'Todas las secciones' }).count(), 0);
        await page.getByRole('navigation', { name: 'Navegación rápida' }).getByRole('link', { name: 'Cuenta', exact: true }).click();
        await page.waitForURL('**/perfil');
        await fits();
        await page.goto(`${BASE}/precios`, { waitUntil: 'networkidle' });
        assert(await page.locator('.native-public-header').isVisible());
        assert(!(await page.locator('.browser-marketing-header').isVisible()));
        await page.locator('.native-public-header').getByRole('link', { name: 'Mi espacio', exact: true }).click();
        await page.waitForURL('**/panel');
        results.push('native dashboard, account tab, accessible sheet, plans keep app chrome');
      }
      await page.goto(`${BASE}/app`); await page.waitForURL('**/panel');
      results.push(`local account flow + account entry redirect: ${email}`);
    }
    if (process.env.PWA_QA_ONLINE_ONLY !== '1') {
    phase = 'offline';
    await context.setOffline(true);
    await page.goto(`${BASE}/app`);
    assert.match(await page.locator('body').innerText(), /Necesitas conexión|necesitas conexión|conexión/i);
    assert.equal(await page.locator('input').count(), 0);
    await page.screenshot({ path: path.join(output, 'pwa-offline.png'), fullPage: true });
    await context.setOffline(false);
    results.push('offline: no account form/data');
    }
    phase = 'reduced motion';
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // New signed-out page, so reduced-motion welcome also works after signup.
    await context.clearCookies();
    await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.market-art-core').evaluate(element => getComputedStyle(element).transform), 'none');
    results.push('reduced-motion artwork disabled');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: results, pageErrors: errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
