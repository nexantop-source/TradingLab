// Only called inside the disposable SQLite + fabricated billing-key fixture.
// Reads public exchange data, never sends an exchange order or a real charge.
const assert = require('node:assert/strict');
const { join } = require('node:path');
module.exports = async (page, engine, base, output) => {
  assert.equal(base, 'https://127.0.0.1:3443');
  const context = page.context();
  const payload = { mode: 'POSITION', symbol: 'BTCUSD', direction: 'BULLISH', stakeCents: 1000,
    rationale: 'Prueba aislada de datos reales y control de riesgo.', confidence: 'MEDIUM', perceivedRisk: 3,
    timeframe: '1m', chartType: 'line', acknowledgedSimulation: true, leverage: 1, durationMinutes: 2 };
  const rejected = await context.request.post(base + '/api/simulations', { data: payload });
  assert([400, 422].includes(rejected.status()), 'Synthetic instruments must be rejected on the real-only server');
  const before = (await (await context.request.get(base + '/api/simulations?limit=3')).json()).data;
  assert.equal(before.simulationsUsedToday, 0);
  assert.equal(before.open.length, 0);
  const initial = page.waitForResponse(r => r.url().includes('/api/market/pulse?symbol=BTCUSDT') && r.status() === 200);
  await page.goto(base + '/terminal', { waitUntil: 'domcontentloaded' });
  const pulse = (await (await initial).json()).data;
  assert.equal(pulse.provenance.synthetic, false);
  assert.equal(pulse.provenance.provider, 'binance-spot-v1');
  assert.equal(pulse.provenance.currency, 'USDT');
  assert(pulse.ticks.every(t => t.candle && t.candle.h >= Math.max(t.candle.o,t.candle.c) && t.candle.l <= Math.min(t.candle.o,t.candle.c)), 'Candles must preserve exchange OHLC');
  assert.equal(await page.locator('.trading-chart').getAttribute('data-chart-type'), 'candles');
  await page.getByText('Datos reales · cada segundo', { exact: true }).waitFor();
  await page.getByLabel('Tiempo de operación', { exact: true }).selectOption('2');
  await page.locator('.simple-up').first().click();
  const review = page.locator('dialog.simple-review');
  await review.locator('#simple-rationale').fill(payload.rationale);
  await review.getByRole('checkbox').check();
  const creation = page.waitForResponse(r => r.url() === base + '/api/simulations' && r.request().method() === 'POST');
  await review.getByRole('button', { name: 'Confirmar operación demo', exact: true }).click();
  const response = await creation;
  const body = await response.json();
  assert.equal(response.status(), 201, JSON.stringify(body));
  assert.equal(body.data.provenance.synthetic, false);
  assert.equal(body.data.provenance.provider, 'Binance Spot');
  await page.locator('.operation-live').getByText(/restantes/).waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  assert(await page.locator('.operation-live').evaluate(element=>{const r=element.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.bottom<innerHeight&&element.contains(top);}), 'Live P&L and countdown cannot be covered by the ticket');
  await page.screenshot({ path: join(output, `${engine}-real-BTCUSDT.png`), fullPage: true });
  const closed = await context.request.post(base + `/api/simulations/${body.data.simulationId}/close`, { data: { fraction: 1 } });
  const result = await closed.json();
  assert.equal(closed.status(), 200, JSON.stringify(result));
  const after = (await (await context.request.get(base + '/api/simulations?limit=3')).json()).data;
  assert.equal(after.open.length, 0);
  assert.equal(after.simulationsUsedToday, 1);
  assert.equal(after.closed[0].priceSourceProvider, 'binance-spot-v1');
  assert.equal(after.balanceCents, result.data.balanceCents);
  await page.goto(base + '/terminal?symbol=AAPL');
  await page.getByRole('heading', { name: 'Fuente real pendiente' }).waitFor();
  assert.equal(await page.locator('.simple-direction-actions').count(), 0);
  return { engine, passed: ['synthetic_open_rejected_without_debit', 'real_Binance_pulse', 'real_price_virtual_position_and_countdown', 'real_price_virtual_settlement', 'stocks_blocked_without_source'], realOrders: 0, realCharges: 0 };
};
