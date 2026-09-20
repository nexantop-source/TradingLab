/**
 * Ciclo completo de la prueba gratuita contra el sandbox real de Wompi, sobre
 * una base de datos aislada y desechable.
 *
 * Prueba lo que ningún test con dobles puede probar: que Wompi acepta nuestra
 * fuente de pago, que el cobro programado sale, y que cancelar impide el cobro.
 *
 *   node --conditions=react-server --import tsx scripts/qa-trial-sandbox.mts
 *
 * Se niega a correr fuera de sandbox.
 */
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const sandbox = Object.fromEntries(
  readFileSync('.env.wompi.sandbox.local', 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^"|"$/g, '')];
    }),
);

if (sandbox.WOMPI_ENVIRONMENT !== 'sandbox') {
  console.error('✖ Solo contra sandbox. Este script crea cobros reales en el ambiente configurado.');
  process.exit(1);
}

const directory = mkdtempSync(join(tmpdir(), 'tradinglab-trial-qa-'));
const empty = new DatabaseSync(join(directory, 'trial.db')); empty.exec('PRAGMA user_version = 0'); empty.close();
Object.assign(process.env, sandbox, {
  DATABASE_URL: `file:${join(directory, 'trial.db').replaceAll('\\', '/')}`,
  DATABASE_PROVIDER: 'sqlite',
  BILLING_PROVIDER: 'wompi',
  NODE_ENV: 'test',
  NEXT_PUBLIC_APP_URL: 'https://local-fixture.invalid',
  WOMPI_PRICING_MODE: 'fixed_cop',
  WOMPI_STANDARD_MONTHLY_AMOUNT_IN_CENTS: '5990000',
  WOMPI_PREMIUM_MONTHLY_AMOUNT_IN_CENTS: '11990000',
});

const init = spawnSync(
  process.execPath,
  [resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate'],
  { env: process.env, encoding: 'utf8' },
);
assert.equal(init.status, 0, `No se pudo inicializar la base aislada: ${init.stderr}`);

const { db } = await import('../src/lib/db');
const { startTrial, cancelTrial, chargeDueSubscriptions, billingOverview, trialEligibility } =
  await import('../src/lib/trials');
const { readWompiConfig } = await import('../src/lib/wompi');

const config = readWompiConfig(process.env, { requireIntegrity: true, requireEvents: true });

/** Rol del navegador: el PAN nunca pasa por el servidor. */
async function tokenizeCard(number: string): Promise<string> {
  const response = await fetch(`${config.apiBaseUrl}/tokens/cards`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.publicKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, cvc: '123', exp_month: '12', exp_year: '34', card_holder: 'QA TRADINGLAB' }),
  });
  const body = await response.json();
  assert.equal(body?.status, 'CREATED', `Tokenización fallida: ${JSON.stringify(body).slice(0, 200)}`);
  return body.data.id as string;
}

async function acceptance() {
  const { acceptanceTokens } = await import('../src/lib/wompi-recurring');
  return acceptanceTokens();
}

function step(label: string) {
  console.log(`\n▸ ${label}`);
}

let failures = 0;
function check(label: string, condition: boolean, detail = '') {
  console.log(`   ${condition ? '✔' : '✖'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures++;
}

try {
  await db.plan.createMany({
    data: [
      { id: 'STANDARD', name: 'Plus', priceMonthlyCents: 1499, priceYearlyCents: 14900 },
      { id: 'PREMIUM', name: 'Pro', priceMonthlyCents: 2999, priceYearlyCents: 29900 },
    ],
  });

  // ── 1. Alta ───────────────────────────────────────────────────────────────
  step('Iniciar la prueba con tarjeta real de sandbox');
  const user = await db.user.create({
    data: { email: 'qa-trial@example.invalid', passwordHash: 'NO_LOGIN', name: 'QA Prueba' },
  });
  const tokens = await acceptance();
  const result = await startTrial({
    userId: user.id,
    email: user.email,
    planId: 'PREMIUM',
    interval: 'MONTHLY',
    cardToken: await tokenizeCard('4242424242424242'),
    acceptanceToken: tokens.termsToken,
    personalDataToken: tokens.personalDataToken,
  });
  check('tarjeta guardada', result.card.lastFour === '4242', `···· ${result.card.lastFour}`);

  const afterStart = await billingOverview(user.id);
  check('estado TRIALING', afterStart.status === 'TRIALING', afterStart.status);
  check('plan concedido', afterStart.plan === 'PREMIUM', afterStart.plan);
  check('días restantes visibles', afterStart.trialDaysLeft === 7, String(afterStart.trialDaysLeft));
  check('tarjeta visible en facturación', afterStart.card?.lastFour === '4242');
  check('mandato guardado', afterStart.mandate !== null);
  check('mandato declara el precio', (afterStart.nextChargeAmountUsdCents ?? 0) === 1999);
  check('fecha de cobro anunciada', afterStart.nextChargeAt !== null);
  check('no se cobró membresía hoy', (await db.payment.count()) === 0);

  const mandate = await db.billingMandate.findFirst({ where: { userId: user.id } });
  check('la tarjeta se validó con un cobro real', Boolean(mandate?.verificationTransactionId), mandate?.verificationTransactionId ?? 'sin transacción');
  check('la validación se devolvió', mandate?.verificationVoided === true);

  // ── 1b. Una tarjeta que el banco rechaza no abre la prueba ────────────────
  step('Una tarjeta que no autoriza no puede abrir la prueba');
  // Guardarla funciona -Wompi la deja AVAILABLE sin preguntarle al banco-, así
  // que este caso es exactamente el que se colaba antes: acceso concedido y
  // primer cobro imposible siete días después.
  const declinedUser = await db.user.create({
    data: { email: 'qa-trial-declined@example.invalid', passwordHash: 'NO_LOGIN', name: 'QA Rechazo' },
  });
  const declinedTokens = await acceptance();
  let declinedCode = 'ninguno';
  try {
    await startTrial({
      userId: declinedUser.id,
      email: declinedUser.email,
      planId: 'PREMIUM',
      interval: 'MONTHLY',
      cardToken: await tokenizeCard('4111111111111111'),
      acceptanceToken: declinedTokens.termsToken,
      personalDataToken: declinedTokens.personalDataToken,
    });
  } catch (error) {
    declinedCode = (error as { code?: string }).code ?? 'sin código';
  }
  check('se rechaza antes de conceder nada', declinedCode === 'CARD_NOT_VERIFIED', declinedCode);
  check('no queda suscripción', (await db.subscription.count({ where: { userId: declinedUser.id } })) === 0);
  check('no queda mandato', (await db.billingMandate.count({ where: { userId: declinedUser.id } })) === 0);

  // ── 2. Una prueba por cuenta ──────────────────────────────────────────────
  step('Una segunda prueba en la misma cuenta debe rechazarse');
  const second = await trialEligibility(user.id);
  check('inelegible', !second.eligible, second.reason);

  // ── 3. Cancelar impide el cobro ───────────────────────────────────────────
  step('Cancelar durante la prueba impide el cobro');
  const canceller = await db.user.create({
    data: { email: 'qa-cancel@example.invalid', passwordHash: 'NO_LOGIN', name: 'QA Cancela' },
  });
  const tokens2 = await acceptance();
  await startTrial({
    userId: canceller.id,
    email: canceller.email,
    planId: 'STANDARD',
    interval: 'MONTHLY',
    cardToken: await tokenizeCard('4242424242424242'),
    acceptanceToken: tokens2.termsToken,
    personalDataToken: tokens2.personalDataToken,
  });
  const cancelled = await cancelTrial({ userId: canceller.id });
  check('conserva el acceso hasta el final', cancelled.accessUntil > new Date());
  check('no se cobra', cancelled.charged === false);
  const cancelledView = await billingOverview(canceller.id);
  check('sin próxima fecha de cobro', cancelledView.nextChargeAt === null);
  check('mandato revocado', cancelledView.mandate?.revokedAt != null);

  // Se adelanta el reloj de ambas cuentas al final de la prueba.
  await db.subscription.updateMany({ data: { nextChargeAt: new Date(Date.now() - 60_000) } });
  // La cancelada no debe recuperar fecha: se restaura su nulo.
  await db.subscription.update({ where: { userId: canceller.id }, data: { nextChargeAt: null } });

  // ── 4. Cobro al vencer ────────────────────────────────────────────────────
  step('Cobrar al vencer la prueba');
  const run = await chargeDueSubscriptions();
  console.log('   informe:', JSON.stringify(run));
  check('una suscripción vencida', run.due === 1, `due=${run.due}`);
  check('cobro enviado a Wompi', run.submitted === 1, `submitted=${run.submitted}`);
  check('la cancelada no se cobró', run.declined === 0 && run.errors === 0);

  const payment = await db.payment.findFirst({ where: { userId: user.id } });
  check('pago registrado', payment !== null);
  check('queda PENDING, no concede acceso', payment?.status === 'PENDING', payment?.status);
  check('importe en COP', payment?.currency === 'COP');
  check('transacción de Wompi asociada', Boolean(payment?.externalId), payment?.externalId ?? '');

  const afterCharge = await db.subscription.findUnique({ where: { userId: user.id } });
  check(
    'sigue TRIALING hasta que el webhook confirme',
    afterCharge?.status === 'TRIALING',
    afterCharge?.status,
  );
  check('fecha de cobro retirada para no cobrar dos veces', afterCharge?.nextChargeAt === null);

  // ── 5. No hay doble cobro ─────────────────────────────────────────────────
  step('Una segunda ejecución del programador no vuelve a cobrar');
  const rerun = await chargeDueSubscriptions();
  check('nada pendiente', rerun.due === 0, `due=${rerun.due}`);
  check('sigue habiendo un solo pago', (await db.payment.count()) === 1);
} finally {
  await db.$disconnect();
}

console.log(
  failures === 0
    ? '\n✔ Ciclo completo verificado contra el sandbox de Wompi.'
    : `\n✖ ${failures} comprobaciones fallidas.`,
);
process.exit(failures === 0 ? 0 : 1);
