/* Imported by qa-native-checkout.cjs after authentication in its disposable
 * SQLite fixture. Real application routes, virtual balance only. This helper
 * refuses non-loopback origins and never opens a broker or payment checkout.
 */
const assert = require('node:assert/strict');
const { join, isAbsolute } = require('node:path');

module.exports = async function checkSimpleTerminal(page, engine, BASE, outputDirectory) {
  const origin = new URL(BASE);
  assert.equal(origin.protocol, 'https:');
  assert.equal(origin.hostname, '127.0.0.1', 'Demo order QA is restricted to the isolated loopback fixture');
  assert.equal(origin.port, '3443');
  assert(isAbsolute(outputDirectory));
  const context = page.context();
  const posts = [];
  let pulseRequests = 0;
  const requestListener = request => {
    const url = new URL(request.url());
    if (url.origin !== BASE) return;
    if (url.pathname === '/api/market/pulse') pulseRequests++;
    if (url.pathname === '/api/simulations' && request.method() === 'POST') posts.push(request.postDataJSON());
  };
  page.on('request', requestListener);
  const screenshot = name => page.screenshot({ path: join(outputDirectory, `${engine}-terminal-${name}.png`), fullPage: true, animations: 'disabled' });
  const pulseResponse = (full = false) => page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.origin === BASE && url.pathname === '/api/market/pulse' && response.status() === 200
      && (!full || !url.searchParams.has('since'));
  }, { timeout: 20_000 });
  const waitLive = () => page.waitForFunction(() => {
    const up = document.querySelector('.simple-direction-actions .simple-up');
    return up && !up.disabled && document.querySelector('.simple-pulse-state')?.textContent?.includes('cada segundo');
  }, null, { timeout: 20_000 });
  const terminal = page.locator('.simple-terminal');
  const amount = page.getByLabel('Monto de la operación', { exact: true });
  const up = terminal.locator('.simple-direction-actions .simple-up');
  const down = terminal.locator('.simple-direction-actions .simple-down');
  const review = page.locator('dialog.simple-review');
  const confirm = review.getByRole('button', { name: 'Confirmar operación demo', exact: true });
  const snapshot = async () => {
    const response = await context.request.get(BASE + '/api/simulations?limit=3');
    assert.equal(response.status(), 200);
    const result = await response.json();
    assert.equal(result.ok, true);
    return result.data;
  };
  const money = cents => `USD ${(cents / 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const waitBalance = expected => page.waitForFunction(text => document.querySelector('.simple-wallet strong')?.textContent === text, money(expected));
  const levels = () => review.locator('.simple-review-summary').evaluate(element => Object.fromEntries(
    [...element.querySelectorAll(':scope > div')].map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]),
  ));

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    const first = pulseResponse(true);
    await page.goto(BASE + '/terminal', { waitUntil: 'domcontentloaded' });
    const firstResponse = await first;
    const initialPulse = (await firstResponse.json()).data;
    await terminal.waitFor();
    await waitLive();
    assert.equal(await terminal.locator('.simple-instrument strong').textContent(), 'BTCUSD');
    assert.equal(await amount.inputValue(), '50');
    assert.match(await up.textContent(), /Subir/);
    assert.match(await down.textContent(), /Bajar/);
    assert.equal(initialPulse.symbol, 'BTCUSD');
    assert.equal(initialPulse.mode, 'DEMO');
    assert.equal(initialPulse.provenance.synthetic, true);
    assert.equal(initialPulse.ticks.length, 121);
    assert.equal(initialPulse.ticks.at(-1).price, initialPulse.quote.price);
    assert.match(firstResponse.headers()['cache-control'], /private.*no-store/);
    const before = await snapshot();
    assert.equal(before.open.length, 0, 'The isolated QA account must begin with no open simulations');
    await waitBalance(before.balanceCents);

    // Three actual responses, never a locally generated random animation.
    let previous = (await (await pulseResponse()).json()).data;
    const cadence = [];
    for (let index = 0; index < 3; index++) {
      const response = await pulseResponse();
      const current = (await response.json()).data;
      assert(current.serverTime >= previous.serverTime);
      assert(current.ticks.length <= 120);
      if (current.ticks.length) assert.equal(current.ticks.at(-1).price, current.quote.price);
      for (const tick of current.ticks) { assert(tick.time <= current.serverTime); assert.equal(tick.time % 1000, 0); }
      cadence.push(current.serverTime - previous.serverTime);
      previous = current;
    }
    assert(cadence.some(delta => delta === 1000), 'At least one received update must advance exactly one second');
    assert(cadence.every(delta => delta <= 3000), 'Healthy fixture must not drift into slow polling');

    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForFunction(() => {
        const svg = document.querySelector('.simple-live-chart__plot');
        return svg && Math.abs(svg.viewBox.baseVal.width - svg.getBoundingClientRect().width) <= 2;
      });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Terminal overflows at ${width}px`);
      const font = await page.locator('.simple-live-chart__grid text').first().evaluate(element => {
        const svg = element.ownerSVGElement;
        return parseFloat(getComputedStyle(element).fontSize) * svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      });
      assert(font >= 10.5, `Chart axis must remain readable at ${width}px; got ${font}px`);
      await page.evaluate(() => scrollTo(0, 0));
      await screenshot(`dark-${width}`);
      if (width === 390) {
        const bounds = await page.locator('.simple-direction-actions').boundingBox();
        assert(bounds.y + bounds.height <= 836, 'Primary direction buttons should fit the first 390×844 view');
        await page.screenshot({ path: join(outputDirectory, `${engine}-terminal-first-screen.png`), fullPage: false, animations: 'disabled' });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '1 min', exact: true }).click();
    assert.equal(await page.locator('.simple-live-chart__caption > span').last().textContent(), '1 minuto');
    await page.getByRole('button', { name: 'Línea', exact: true }).click();
    assert.equal(await page.locator('.simple-live-chart__plot path[fill^="url"]').count(), 0);
    await page.getByRole('button', { name: 'Área', exact: true }).click();
    await page.getByRole('button', { name: '2 min', exact: true }).click();

    // Exercise the same document TouchEvent recognizer in both engines. This
    // checks exclusion, not a physical iPhone's reserved OS edge gesture.
    await page.locator('.simple-live-chart').evaluate(element => {
      const rect = element.getBoundingClientRect();
      const x = rect.left + 25, y = rect.top + 70;
      for (const [type, dx] of [['touchstart', 0], ['touchmove', 70], ['touchmove', 170], ['touchend', 170]]) {
        const point = { identifier: 1, clientX: x + dx, clientY: y, target: element };
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } });
        element.dispatchEvent(event);
      }
    });
    assert(!(await page.locator('.native-gesture-drawer').evaluate(element => element.open)), 'Chart interaction must not reveal the menu');

    await context.setOffline(true);
    await page.waitForFunction(() => document.querySelector('.simple-pulse-state')?.textContent === 'Sin conexión');
    assert(await up.isDisabled()); assert(await down.isDisabled());
    const frozenPrice = await page.getByTestId('simple-live-price').textContent();
    const frozenPath = await page.locator('.simple-live-chart__line').getAttribute('d');
    const offlineRequests = pulseRequests;
    await page.waitForTimeout(1600);
    assert.equal(pulseRequests, offlineRequests, 'Offline polling must stop');
    assert.equal(await page.getByTestId('simple-live-price').textContent(), frozenPrice);
    assert.equal(await page.locator('.simple-live-chart__line').getAttribute('d'), frozenPath, 'Offline chart must not fabricate movement');
    await screenshot('offline');
    const restoredResponse = pulseResponse(true);
    await context.setOffline(false);
    assert.equal((await (await restoredResponse).json()).data.ticks.length, 121);
    await waitLive();

    // Deterministic visibility signal; not a claim of physical background QA.
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => document.querySelector('.simple-pulse-state')?.textContent === 'En pausa');
    const hiddenRequests = pulseRequests;
    await page.waitForTimeout(1200);
    assert.equal(pulseRequests, hiddenRequests, 'Background signal must stop polling');
    const resumedResponse = pulseResponse(true);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await resumedResponse;
    await waitLive();

    for (const invalid of ['-1', '1e3', '1.001', '100001']) {
      await amount.fill(invalid); await up.click();
      await terminal.locator('.simple-order-error').waitFor();
      assert(!(await review.isVisible()));
      assert.equal(posts.length, 0);
    }
    await amount.fill('99999'); await up.click();
    assert.match(await terminal.locator('.simple-order-error').textContent(), /saldo/);
    await amount.fill('25,50');
    await page.locator('.simple-risk-controls summary').click();
    await page.getByLabel('Distancia de stop loss en porcentaje', { exact: true }).fill('96');
    await up.click();
    assert.match(await terminal.locator('.simple-order-error').textContent(), /95/);
    await page.getByLabel('Distancia de stop loss en porcentaje', { exact: true }).fill('5');
    await page.getByLabel('Distancia de take profit en porcentaje', { exact: true }).fill('10');
    await up.click(); await review.waitFor();
    let summary = await levels();
    assert(Number(summary['Stop loss']) < Number(summary['Entrada estimada']));
    assert(Number(summary['Take profit']) > Number(summary['Entrada estimada']));
    assert.equal(posts.length, 0, 'Choosing a direction only reviews; it must not submit');
    await review.getByRole('button', { name: 'Volver sin abrir', exact: true }).click();
    await down.click(); await review.waitFor();
    summary = await levels();
    assert(Number(summary['Stop loss']) > Number(summary['Entrada estimada']));
    assert(Number(summary['Take profit']) < Number(summary['Entrada estimada']));
    assert(await confirm.isDisabled());
    await review.locator('#simple-rationale').fill('Observo el movimiento demo y comparo el escenario bajista con el riesgo elegido.');
    assert(await confirm.isDisabled(), 'Rationale alone cannot authorize the exercise');
    await review.getByRole('checkbox').check();
    await review.locator('#simple-rationale').fill('Corto');
    assert(await confirm.isDisabled(), 'Acknowledgement alone cannot skip educational rationale');
    await review.locator('#simple-rationale').fill('Observo el movimiento demo y comparo el escenario bajista con el riesgo elegido.');
    assert.equal(posts.length, 0);
    await screenshot('review');

    // Hold a pre-order snapshot, then deliver it after the order commits. It
    // must be aborted/invalidated instead of restoring the old virtual balance.
    let releaseSnapshot;
    const heldSnapshot = new Promise(resolve => { releaseSnapshot = resolve; });
    let snapshotStarted;
    const startedSnapshot = new Promise(resolve => { snapshotStarted = resolve; });
    await page.route('**/api/simulations?limit=3', async route => {
      snapshotStarted();
      await heldSnapshot;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: before }) }).catch(() => {});
    }, { times: 1 });
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await Promise.race([startedSnapshot, new Promise((_, reject) => setTimeout(() => reject(Error('No pending snapshot for race check')), 15000))]);
    await waitLive();

    const createResponse = page.waitForResponse(response => response.url() === BASE + '/api/simulations' && response.request().method() === 'POST');
    await confirm.click();
    const createdResponse = await createResponse;
    const createdBody = await createdResponse.json();
    assert.equal(createdResponse.status(), 201, JSON.stringify(createdBody));
    const created = createdBody.data;
    releaseSnapshot();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].mode, 'POSITION'); assert.equal(posts[0].direction, 'BEARISH');
    assert.equal(posts[0].stakeCents, 2550); assert.equal(posts[0].leverage, 1);
    assert.equal(posts[0].acknowledgedSimulation, true);
    assert.equal(created.provenance.synthetic, true);
    assert.equal(created.balanceCents, before.balanceCents - 2550 - created.feeCents);
    await review.waitFor({ state: 'hidden' });
    await waitBalance(created.balanceCents);
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.simple-wallet strong').textContent(), money(created.balanceCents), 'An older snapshot must not overwrite the confirmed order balance');
    const open = await snapshot();
    assert(open.open.some(position => position.id === created.simulationId));
    const row = page.locator('.simple-positions li').filter({ hasText: 'BTCUSD' });
    await row.getByRole('button', { name: 'Cerrar', exact: true }).waitFor();
    await waitLive();
    await screenshot('position');
    const closeResponse = page.waitForResponse(response => response.url() === BASE + `/api/simulations/${created.simulationId}/close`);
    await row.getByRole('button', { name: 'Cerrar', exact: true }).click();
    const closedResponse = await closeResponse;
    const closedBody = await closedResponse.json();
    assert.equal(closedResponse.status(), 200, JSON.stringify(closedBody));
    const closed = closedBody.data;
    assert.equal(closed.simulationId, created.simulationId);
    assert.equal(closed.closeReason, 'MANUAL');
    assert.equal(closed.balanceCents, created.balanceCents + Math.max(0, 2550 + closed.pnlCents));
    await waitBalance(closed.balanceCents);
    const after = await snapshot();
    assert.equal(after.balanceCents, closed.balanceCents);
    assert(!after.open.some(position => position.id === created.simulationId));
    assert(after.closed.some(position => position.id === created.simulationId && position.closeReason === 'MANUAL'));
    await page.getByRole('button', { name: 'Cerradas', exact: true }).click();
    await screenshot('closed');

    await page.getByRole('button', { name: 'Avanzado', exact: true }).click();
    await page.locator('[data-view="advanced"]').waitFor();
    assert(!(await terminal.isVisible()));
    await page.getByRole('button', { name: 'Simple', exact: true }).click();
    await terminal.waitFor(); await waitLive();
    await page.evaluate(() => scrollTo(0, 0));
    await screenshot('restored');
    return { engine, passed: ['default_BTC_simple', 'received_1Hz_demo_ticks', 'readable_axes_320_390_430', 'line_area_and_time_window', 'chart_excludes_drawer', 'offline_freeze_no_polling', 'background_signal_pause_resume', 'amount_validation', 'SL_TP_direction_mapping', 'review_before_POST', 'rationale_and_ack_required', 'real_local_demo_create_201', 'manual_close_and_ledger_balance', 'advanced_toggle'], demoSimulationId: created.simulationId, realOrders: 0, realCharges: 0 };
  } catch (error) {
    await screenshot('failure').catch(() => {});
    throw error;
  } finally {
    page.off('request', requestListener);
    await context.setOffline(false);
    await page.evaluate(() => { if (Object.hasOwn(document, 'hidden')) { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); } }).catch(() => {});
  }
};
