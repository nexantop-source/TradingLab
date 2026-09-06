/* Guest-only presentation checks. The caller owns the isolated browser context,
 * origin allow-list, service-worker policy, Next server and error capture.
 * This helper never signs in, creates accounts or submits a trade/payment.
 */
const assert = require('node:assert/strict');
const { join, isAbsolute } = require('node:path');

module.exports = async function checkWelcomeScenes(page, engine, base, outputDirectory) {
  assert(isAbsolute(outputDirectory), 'Welcome screenshots need an absolute output directory');
  const initialViewport = page.viewportSize();
  const mutations = [];
  const observeRequest = request => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() !== 'GET' && /^\/api\/(?:simulations|billing|payments)(?:\/|$)/.test(pathname)) mutations.push(`${request.method()} ${pathname}`);
  };
  page.on('request', observeRequest);
  const checks = [];
  const screenshots = [];

  async function settle(name) {
    await page.waitForFunction(name => {
      const root = document.querySelector(`.welcome-app[data-welcome-scene="${name}"]`);
      if (!root || root.querySelectorAll('.welcome-scene-art').length !== 1) return false;
      const art = root.querySelector('.welcome-scene-art');
      return Number(getComputedStyle(art).opacity) > 0.98 && Array.from(art.querySelectorAll('[style*="opacity"]')).every(node => Number(getComputedStyle(node).opacity) > 0.98);
    }, name);
  }

  async function verifyLayout(width) {
    const bounds = await page.evaluate(() => {
      const root = document.querySelector('.welcome-app');
      const stage = root.querySelector('.welcome-stage').getBoundingClientRect();
      const content = root.querySelector('.welcome-content').getBoundingClientRect();
      const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const targets = Array.from(root.querySelectorAll('button:not(:disabled), a, summary')).filter(element => element.getBoundingClientRect().width > 0).map(element => ({ label: element.getAttribute('aria-label') || element.textContent.trim(), height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width }));
      const tickets = Array.from(root.querySelectorAll('.welcome-lesson-ticket, .welcome-practice-ticket, .welcome-journal-ticket')).map(element => { const rect = element.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom }; });
      const ticketContentFits = Array.from(root.querySelectorAll('.welcome-lesson-ticket, .welcome-practice-ticket, .welcome-journal-ticket')).every(element => element.scrollHeight <= element.clientHeight + 1);
      const riskChip = root.querySelector('.welcome-risk-chip')?.getBoundingClientRect();
      return { overflow, stageBottom: stage.bottom, contentTop: content.top, targets, tickets, ticketContentFits, riskBottom: riskChip?.bottom };
    });
    assert(bounds.overflow <= width + 1, `Guest introduction must not overflow horizontally at ${width}px`);
    assert(bounds.contentTop >= bounds.stageBottom - 1, 'Artwork must not cover the explanatory copy');
    assert(bounds.ticketContentFits, 'Learning ticket copy must not spill outside its card');
    assert(bounds.tickets.every(ticket => ticket.bottom <= bounds.stageBottom + 1), 'Learning tickets must fit within the illustration');
    if (bounds.riskBottom) assert(bounds.riskBottom <= bounds.contentTop + 1, 'Demo risk guidance must not cover the heading');
    for (const target of bounds.targets) assert(target.height >= 43 && target.width >= 43, `Touch target ${target.label} is too small (${target.width} × ${target.height}px)`);
    for (let index = 1; index < bounds.tickets.length; index++) assert(bounds.tickets[index].top >= bounds.tickets[index - 1].bottom - 1, 'Learning ticket text must remain unobscured');
  }

  async function capture(name, width) {
    await page.evaluate(() => scrollTo(0, 0));
    const filename = join(outputDirectory, `${engine}-welcome-${name}-${width}.png`);
    await page.screenshot({ path: filename, fullPage: true, animations: 'disabled' });
    screenshots.push(filename);
  }

  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(new URL('/app', base).href, { waitUntil: 'networkidle' });
    await settle('markets');
    assert.equal(new URL(page.url()).pathname, '/app', 'Caller must supply a signed-out page');
    assert.equal(await page.locator('.welcome-signin').getAttribute('href'), '/entrar');
    assert.equal(await page.locator('.welcome-create').getAttribute('href'), '/crear-cuenta');
    assert.equal(await page.locator('.welcome-app a[href="/entrar"]').count(), 1, 'Login must not be duplicated');
    assert.equal(await page.locator('.welcome-app a[href="/crear-cuenta"]').count(), 1, 'Signup must be immediately available without a tour gate');
    assert(await page.getByRole('button', { name: 'Anterior', exact: true }).isDisabled());
    assert((await page.locator('.welcome-legal').textContent()).includes('No es un broker'));
    checks.push('guest_entry_immediate_signup_single_login_legal');

    await page.getByRole('button', { name: 'Descubrir Apple', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Descubrir Apple', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.welcome-market-caption strong').textContent(), 'Apple');
    assert((await page.locator('.welcome-market-caption p').textContent()).includes('empresa'));
    assert.equal(await page.locator('.welcome-instrument img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0 && new URL(image.src).origin === location.origin)), true, 'Instrument logos must load locally');
    checks.push('interactive_local_instrument_identities');

    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await settle('practice');
    await page.getByRole('button', { name: 'Subir', exact: true }).click();
    assert.equal(await page.locator('.welcome-demo-chart').getAttribute('data-demo-direction'), 'up');
    const upPath = await page.locator('.welcome-demo-chart svg path').last().getAttribute('d');
    await page.getByRole('button', { name: 'Bajar', exact: true }).click();
    assert.equal(await page.locator('.welcome-demo-chart').getAttribute('data-demo-direction'), 'down');
    await page.waitForFunction(previous => document.querySelector('.welcome-demo-chart svg path:last-of-type')?.getAttribute('d') !== previous, upPath);
    assert((await page.locator('.welcome-demo-response').textContent()).includes('Si baja'));
    assert((await page.locator('.welcome-practice-scene').textContent()).includes('SIN DINERO REAL'));
    checks.push('hypothetical_chart_up_down_response_no_order');

    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await settle('learning');
    await page.getByRole('button', { name: 'Lo que aprendí', exact: true }).click();
    assert((await page.locator('.welcome-journal-ticket p').textContent()).includes('diferente'));
    await page.getByRole('button', { name: 'Lo que observé', exact: true }).click();
    assert((await page.locator('.welcome-journal-ticket p').textContent()).includes('gráfico'));
    assert(await page.getByRole('button', { name: 'Siguiente', exact: true }).isDisabled());
    checks.push('reflection_preview_and_carousel_bounds');

    // Keep each composition readable at common iPhone sizes, including 320px.
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      const ctaPositions = [];
      for (const [index, name] of ['markets', 'practice', 'learning'].entries()) {
        await page.getByRole('button', { name: new RegExp(`^Pantalla ${index + 1}:`) }).click();
        await settle(name);
        await capture(name, width);
        await verifyLayout(width);
        ctaPositions.push((await page.locator('.welcome-create').boundingBox()).y);
      }
      assert(Math.max(...ctaPositions) - Math.min(...ctaPositions) <= 2, 'Signup CTA must not jump between scenes');
    }
    checks.push('three_distinct_compositions_320_390_430_no_overlap_44px_targets');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: /^Pantalla 1:/ }).focus();
    await page.keyboard.press('Enter');
    await settle('markets');
    assert.equal(await page.locator('.welcome-scene-art').evaluate(element => getComputedStyle(element).transform), 'none');
    await page.getByRole('button', { name: 'Siguiente', exact: true }).focus();
    await page.keyboard.press('Enter');
    await settle('practice');
    await page.getByRole('button', { name: 'Subir', exact: true }).focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.welcome-demo-chart').getAttribute('data-demo-direction'), 'up');
    await capture('practice-reduced-motion', 390);
    checks.push('keyboard_controls_reduced_motion_preserves_interaction');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: /^Pantalla 1:/ }).click();
    await settle('markets');
    assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= 1281);
    await capture('markets-desktop', 1280);
    checks.push('desktop_composition');

    assert.deepEqual(mutations, [], 'Welcome interactions must not submit trades, payments or subscriptions');
    return { engine, checks, screenshots, tradeOrPaymentMutations: 0 };
  } finally {
    page.off('request', observeRequest);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    if (initialViewport) await page.setViewportSize(initialViewport);
  }
};
