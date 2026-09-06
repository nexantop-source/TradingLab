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
  const releases = [];
  const routeCleanup = [];
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const bounded = async (promise, message) => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(message)), 20_000); })]); }
    finally { clearTimeout(timer); }
  };
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
    assert.equal(before.simulationsUsedToday, 0);
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
        const chart = document.querySelector('.trading-chart-canvas');
        return chart && chart.querySelector('canvas') && chart.getBoundingClientRect().width <= innerWidth;
      });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Terminal overflows at ${width}px`);
      assert(await page.locator('.trading-chart canvas').count() > 0, 'TradingView canvas must be mounted');
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
    assert.equal(await page.locator('.trading-chart').getAttribute('data-window'), '60');
    await page.getByRole('button', { name: 'Línea', exact: true }).click();
    assert.equal(await page.locator('.trading-chart').getAttribute('data-chart-type'), 'line');
    await page.getByRole('button', { name: 'Área', exact: true }).click();
    await page.getByRole('button', { name: '2 min', exact: true }).click();

    // Exercise the same document TouchEvent recognizer in both engines. This
    // checks exclusion, not a physical iPhone's reserved OS edge gesture.
    await page.locator('.trading-chart').evaluate(element => {
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
    const frozenChart = await page.locator('.trading-chart').innerText();
    const offlineRequests = pulseRequests;
    await page.waitForTimeout(1600);
    assert.equal(pulseRequests, offlineRequests, 'Offline polling must stop');
    assert.equal(await page.getByTestId('simple-live-price').textContent(), frozenPrice);
    assert.equal(await page.locator('.trading-chart').innerText(), frozenChart, 'Offline chart must not fabricate movement');
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
    await page.getByLabel('Tiempo de operación', { exact: true }).selectOption('2');
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
    assert.equal(await review.locator('#simple-rationale').count(), 0, 'No mandatory explanation field');
    await review.getByRole('checkbox').check();
    assert(await confirm.isEnabled(), 'Valid practice needs no written explanation');
    assert.equal(posts.length, 0);
    await screenshot('review');

    // Hold a pre-order snapshot, then deliver it after the order commits. It
    // must be aborted/invalidated instead of restoring the old virtual balance.
    let releaseSnapshot;
    const heldSnapshot = new Promise(resolve => { releaseSnapshot = resolve; });
    releases.push(releaseSnapshot);
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

    // Keep refresh A's actual server response (read after opening, before
    // closing) in flight. Refresh B stays held while the older A is delivered.
    const rscPattern = '**/terminal?*';
    const rscReady = [deferred(), deferred()];
    const rscRelease = [deferred(), deferred()];
    const rscDelivered = [deferred(), deferred()];
    let rscCount = 0;
    const rscHandler = async route => {
      if (route.request().headers().rsc !== '1' || rscCount >= 2) return route.fallback();
      const index = rscCount++;
      try {
        const response = await route.fetch();
        const body = await response.body();
        rscReady[index].resolve({ status: response.status(), body: body.toString(), contentType: response.headers()['content-type'] });
        await rscRelease[index].promise;
        await route.fulfill({ response, body });
        rscDelivered[index].resolve();
      } catch (error) {
        rscReady[index].resolve({ error });
        rscDelivered[index].resolve();
      }
    };
    await page.route(rscPattern, rscHandler);
    routeCleanup.push(() => page.unroute(rscPattern, rscHandler));
    releases.push(...rscRelease.map(gate => gate.resolve));

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
    assert.equal(posts[0].durationMinutes, 2);
    assert(Date.parse(created.expiresAt) > Date.now());
    assert.equal(posts[0].acknowledgedSimulation, true);
    assert.equal(posts[0].rationale, undefined);
    assert.equal(created.provenance.synthetic, true);
    assert.equal(created.balanceCents, before.balanceCents - 2550 - created.feeCents);
    await review.waitFor({ state: 'hidden' });
    await waitBalance(created.balanceCents);
    await page.locator('.operation-live').getByText(/restantes/).waitFor();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.simple-wallet strong').textContent(), money(created.balanceCents), 'An older snapshot must not overwrite the confirmed order balance');
    const open = await snapshot();
    assert(open.open.some(position => position.id === created.simulationId));
    assert.equal(open.simulationsUsedToday, 1);
    const heldRsc = await bounded(rscReady[0].promise, 'Refresh A did not produce a retained server response');
    assert(!heldRsc.error, heldRsc.error?.message);
    assert.equal(heldRsc.status, 200);
    assert.match(heldRsc.contentType, /text\/x-component/);
    assert(heldRsc.body.includes(created.simulationId), 'Held RSC A must contain the newly opened position, before its close');
    const row = page.locator('.simple-positions li').filter({ hasText: 'BTCUSD' });
    await row.getByRole('button', { name: 'Cerrar', exact: true }).waitFor();
    await waitLive();
    await screenshot('position');
    const closeResponse = page.waitForResponse(response => response.url() === BASE + `/api/simulations/${created.simulationId}/close`);
    const postCloseSnapshot = page.waitForResponse(response => response.url() === BASE + '/api/simulations?limit=3' && response.request().method() === 'GET' && response.status() === 200);
    await row.getByRole('button', { name: 'Cerrar', exact: true }).click();
    const closedResponse = await closeResponse;
    const closedBody = await closedResponse.json();
    assert.equal(closedResponse.status(), 200, JSON.stringify(closedBody));
    const closed = closedBody.data;
    assert.equal(closed.simulationId, created.simulationId);
    assert.equal(closed.closeReason, 'MANUAL');
    assert.equal(closed.balanceCents, created.balanceCents + Math.max(0, 2550 + closed.pnlCents));
    await waitBalance(closed.balanceCents);
    const currentSnapshotResponse = await postCloseSnapshot;
    await currentSnapshotResponse.finished();
    const currentSnapshot = (await currentSnapshotResponse.json()).data;
    assert.equal(currentSnapshot.balanceCents, closed.balanceCents);
    assert.equal(currentSnapshot.simulationsUsedToday, 1);
    await page.waitForFunction(() => document.querySelectorAll('.simple-positions li').length === 0);

    // Prevent a later JSON poll from masking a transient rollback while the
    // old RSC is applied. Mutation B's authoritative snapshot is already read.
    const freshJsonRelease = deferred();
    const freshJsonHandler = async route => { await freshJsonRelease.promise; await route.continue().catch(() => {}); };
    await page.route('**/api/simulations?limit=3', freshJsonHandler);
    routeCleanup.push(() => page.unroute('**/api/simulations?limit=3', freshJsonHandler));
    releases.push(freshJsonRelease.resolve);
    rscRelease[0].resolve();
    await bounded(rscDelivered[0].promise, 'Refresh A was not delivered');
    const heldSecondRsc = await bounded(rscReady[1].promise, 'Refresh B did not remain queued behind refresh A');
    assert(!heldSecondRsc.error, heldSecondRsc.error?.message);
    assert.equal(heldSecondRsc.status, 200);
    await page.waitForTimeout(450);
    assert.equal(await page.locator('.simple-wallet strong').textContent(), money(closed.balanceCents), 'An older RSC refresh must not restore the pre-close balance');
    assert.equal(await page.locator('.simple-positions li').count(), 0, 'An older RSC refresh must not restore the closed position');
    await screenshot('rsc-race');
    rscRelease[1].resolve();
    await bounded(rscDelivered[1].promise, 'Refresh B was not delivered');
    freshJsonRelease.resolve();
    await page.unroute('**/api/simulations?limit=3', freshJsonHandler);
    await page.unroute(rscPattern, rscHandler);
    const after = await snapshot();
    assert.equal(after.balanceCents, closed.balanceCents);
    assert(!after.open.some(position => position.id === created.simulationId));
    assert(after.closed.some(position => position.id === created.simulationId && position.closeReason === 'MANUAL'));
    await page.getByRole('button', { name: 'Cerradas', exact: true }).click();
    await screenshot('closed');

    assert.equal(await page.getByRole('button', { name: 'Avanzado', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Herramientas', exact: true }).click();
    await page.getByRole('button', { name: 'Velas · 5 s', exact: true }).click();
    assert.equal(await page.locator('.trading-chart').getAttribute('data-chart-type'), 'candles');
    await page.getByRole('button', { name: 'Media SMA20', exact: true }).click();
    assert.equal(await page.getByRole('link', { name: 'EMA12 · Mejorar a Plus' }).getAttribute('href'), '/precios');
    await page.getByRole('button', { name: 'Herramientas', exact: true }).click();
    await terminal.waitFor(); await waitLive();
    await page.evaluate(() => scrollTo(0, 0));
    await screenshot('restored');
    return { engine, passed: ['default_BTC_simple', 'received_1Hz_demo_ticks', 'readable_axes_320_390_430', 'line_area_and_time_window', 'chart_excludes_drawer', 'offline_freeze_no_polling', 'background_signal_pause_resume', 'amount_validation', 'SL_TP_direction_mapping', 'review_before_POST', 'rationale_and_ack_required', 'real_local_demo_create_201', 'stale_snapshot_cannot_restore_balance', 'stale_RSC_cannot_restore_closed_position_or_balance', 'quota_from_authoritative_JSON_snapshot', 'manual_close_and_ledger_balance', 'advanced_toggle'], demoSimulationId: created.simulationId, realOrders: 0, realCharges: 0 };
  } catch (error) {
    await screenshot('failure').catch(() => {});
    throw error;
  } finally {
    for (const release of releases) release();
    for (const cleanup of routeCleanup) await cleanup().catch(() => {});
    page.off('request', requestListener);
    await context.setOffline(false);
    await page.evaluate(() => { if (Object.hasOwn(document, 'hidden')) { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); } }).catch(() => {});
  }
};
