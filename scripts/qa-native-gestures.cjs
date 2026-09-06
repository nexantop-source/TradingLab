/* Focused browser checks, called after a signed-in fixture's /panel tour is closed.
 * Chromium uses native CDP touch input. WebKit uses the same DOM TouchEvent stream;
 * it does not claim to emulate physical iPhone OS history gestures.
 * No network, accounts, payments or history mutations are performed here.
 */
const assert = require('node:assert/strict');
const { join } = require('node:path');

module.exports = async function checkNativeGestures(page, engine) {
  const drawer = page.locator('.native-gesture-drawer');
  await drawer.waitFor({ state: 'attached' });
  const trigger = page.getByRole('button', { name: 'Abrir menú', exact: true });
  await trigger.focus();
  // The preceding onboarding restores focus to its replay control near the
  // bottom of the page. Scroll to an actual visible content target before touch.
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => scrollY === 0);
  const point = await page.locator('.native-home-greeting h1').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: Math.max(24, rect.left + 6), y: rect.top + 24 };
  });
  const cdp = engine === 'chromium' ? await page.context().newCDPSession(page) : null;
  assert(await page.evaluate(point => point.y > 0 && point.y < innerHeight && point.x > 0 && point.x < innerWidth && Boolean(document.elementFromPoint(point.x, point.y)?.closest('.native-home-greeting')), point), 'Touch target must be visible content, not off-screen coordinates after the tour');
  let target;
  const touch = async (type, x, y, extraTouch = false) => {
    if (cdp) {
      const points = type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1 }, ...(extraTouch ? [{ x: x + 50, y: y + 20, id: 2 }] : [])];
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    } else {
      if (type === 'touchStart') target = await page.evaluateHandle(({ x, y }) => document.elementFromPoint(x, y), { x, y });
      await page.evaluate(({ element, type, x, y, extraTouch }) => {
        const point = { identifier: 1, clientX: x, clientY: y, target: element };
        const touches = type === 'touchEnd' || type === 'touchCancel' ? [] : [point, ...(extraTouch ? [{ ...point, identifier: 2, clientX: x + 50 }] : [])];
        const event = new Event(type.toLowerCase(), { bubbles: true, cancelable: true });
        Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: [point] } });
        element.dispatchEvent(event);
      }, { element: target, type, x, y, extraTouch });
    }
  };
  const visible = async () => drawer.evaluate(element => element.open);
  const move = async (x, y) => { await touch('touchMove', x, y); await page.waitForTimeout(22); };

  try {
    await touch('touchStart', point.x, point.y);
    await move(point.x + 44, point.y + 1);
    assert(await visible(), 'Rightward content swipe must reveal drawer before release');
    const dragX = await drawer.locator('.native-drawer-panel').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m41);
    assert(dragX < -30 && dragX > -340, 'Drawer should follow finger continuously, not snap on release');
    await move(point.x + 145, point.y + 1);
    await move(point.x + 260, point.y + 1);
    await touch('touchEnd', point.x + 260, point.y);
    await page.waitForFunction(() => document.querySelector('.app-menu-trigger')?.getAttribute('aria-expanded') === 'true');
    await page.waitForFunction(() => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.native-drawer-panel')).transform).m41) < 1);
    if (process.env.PWA_QA_OUTPUT) await page.screenshot({ path: join(process.env.PWA_QA_OUTPUT, `${engine}-native-drawer.png`), animations: 'disabled' });

    for (let index = 0; index < 18; index++) {
      await page.keyboard.press('Tab');
      assert(await drawer.evaluate(element => element.contains(document.activeElement)), 'Focus must stay inside the modal drawer');
    }
    await page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'hidden' });
    assert(await trigger.evaluate(element => document.activeElement === element), 'Escape must restore focus to menu button');

    // Vertical intent and opted-out regions leave scrolling / charts alone.
    await page.evaluate(() => scrollTo(0, 0));
    await touch('touchStart', point.x, point.y);
    await move(point.x + 2, point.y + 70);
    await touch('touchEnd', point.x + 2, point.y + 70);
    assert(!(await visible()), 'Vertical scroll must not open navigation');
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator('.native-home-greeting').evaluate(element => element.setAttribute('data-gesture-exclude', ''));
    await touch('touchStart', point.x, point.y);
    await move(point.x + 210, point.y + 2);
    await touch('touchEnd', point.x + 210, point.y + 2);
    assert(!(await visible()), 'Explicit chart / gesture opt-out must win');
    await page.locator('.native-home-greeting').evaluate(element => element.removeAttribute('data-gesture-exclude'));

    await touch('touchStart', point.x, point.y);
    await touch('touchStart', point.x, point.y, true);
    await touch('touchEnd', point.x, point.y);
    assert(!(await visible()), 'Multi-touch must cancel the drawer recognizer');

    await trigger.click();
    await drawer.waitFor();
    await page.waitForFunction(() => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.native-drawer-panel')).transform).m41) < 1);
    const closePoint = await drawer.locator('.app-balance-card').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.right - 24, y: rect.top + rect.height / 2 };
    });
    await touch('touchStart', closePoint.x, closePoint.y);
    await move(closePoint.x - 80, closePoint.y);
    await move(closePoint.x - 220, closePoint.y);
    await touch('touchEnd', closePoint.x - 220, closePoint.y);
    await drawer.waitFor({ state: 'hidden' });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await trigger.click();
    await drawer.waitFor();
    assert.equal(await drawer.locator('.native-drawer-panel').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m41), 0);
    await page.getByRole('button', { name: 'Cerrar menú', exact: true }).last().click();
    await drawer.waitFor({ state: 'hidden' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    return { engine, gestureInput: cdp ? 'CDP native touch' : 'DOM TouchEvent recognizer', checks: ['continuous_open', 'focus_trap_escape_restore', 'vertical_scroll_yields', 'chart_opt_out', 'multi_touch_yields', 'swipe_close', 'button_fallback', 'reduced_motion'] };
  } finally { await cdp?.detach(); }
};
