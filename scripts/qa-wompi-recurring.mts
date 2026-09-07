/**
 * Prueba de extremo a extremo del cobro con tarjeta guardada, contra el
 * sandbox real de Wompi.
 *
 * Recorre el mismo camino que hará una persona: tokenizar la tarjeta con la
 * llave pública (lo que en producción ocurre en el navegador), canjear el token
 * por una fuente de pago con la llave privada y cobrarla. Sirve para verificar
 * las credenciales y el contrato de la API sin tocar dinero real.
 *
 *   npx tsx scripts/qa-wompi-recurring.ts
 *
 * Se niega a ejecutarse fuera de sandbox: este script cobra de verdad.
 */
import { readFileSync } from 'node:fs';

for (const [key, value] of Object.entries(
  Object.fromEntries(
    readFileSync('.env.wompi.sandbox.local', 'utf8')
      .split('\n')
      .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
      .map((line) => {
        const at = line.indexOf('=');
        return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^"|"$/g, '')];
      }),
  ),
)) {
  process.env[key] = value;
}

if (process.env.WOMPI_ENVIRONMENT !== 'sandbox') {
  console.error('✖ Este script solo se ejecuta contra sandbox. Cobra de verdad.');
  process.exit(1);
}

const { acceptanceTokens, createPaymentSource, chargePaymentSource } = await import(
  '../src/lib/wompi-recurring'
);
const { readWompiConfig } = await import('../src/lib/wompi');

/** Tarjetas de prueba documentadas por Wompi. */
const CARDS = {
  aprobada: '4242424242424242',
  rechazada: '4111111111111111',
};

const config = readWompiConfig(process.env, { requireIntegrity: true });

function step(label: string) {
  console.log(`\n▸ ${label}`);
}

/** Lo que en producción hace el navegador: el PAN nunca pasa por el servidor. */
async function tokenizeCard(number: string): Promise<string> {
  const response = await fetch(`${config.apiBaseUrl}/tokens/cards`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.publicKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number,
      cvc: '123',
      exp_month: '12',
      exp_year: '34',
      card_holder: 'PRUEBA TRADINGLAB',
    }),
  });
  const body = await response.json();
  if (!response.ok || body?.status !== 'CREATED') {
    throw new Error(`Tokenización fallida: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body.data.id as string;
}

step('Tokens de aceptación');
const tokens = await acceptanceTokens();
console.log('  términos          :', tokens.termsToken.slice(0, 18) + '…');
console.log('  datos personales  :', tokens.personalDataToken.slice(0, 18) + '…');
console.log('  enlace de términos:', tokens.termsUrl);

step('Tokenizar la tarjeta (rol del navegador)');
const cardToken = await tokenizeCard(CARDS.aprobada);
console.log('  token de un solo uso:', cardToken.slice(0, 18) + '…');

step('Crear la fuente de pago (llave privada)');
const source = await createPaymentSource({
  cardToken,
  acceptanceToken: tokens.termsToken,
  personalDataToken: tokens.personalDataToken,
  email: 'qa-tradinglab@example.com',
});
console.log('  id fuente :', source.wompiId);
console.log('  tarjeta   :', source.brand, '····', source.lastFour, `(${source.expMonth}/${source.expYear})`);

step('Cobrar la fuente guardada');
const reference = `tl_qa_${Date.now().toString(36)}`;
const charge = await chargePaymentSource({
  paymentSourceId: source.wompiId,
  amountInCents: 5_000_00, // COP 5.000
  reference,
  email: 'qa-tradinglab@example.com',
});
console.log('  referencia :', charge.reference);
console.log('  transacción:', charge.transactionId);
console.log('  estado     :', charge.status, charge.statusMessage ? `· ${charge.statusMessage}` : '');

step('Rechazar un cobro duplicado con la misma referencia');
try {
  await chargePaymentSource({
    paymentSourceId: source.wompiId,
    amountInCents: 5_000_00,
    reference,
    email: 'qa-tradinglab@example.com',
  });
  console.log('  ✖ Wompi ACEPTÓ una referencia repetida: la idempotencia no puede apoyarse solo en esto.');
} catch (error) {
  console.log('  ✔ rechazado:', (error as Error).message);
}

step('Una tarjeta rechazada no debe quedar guardada');
try {
  const badToken = await tokenizeCard(CARDS.rechazada);
  const badSource = await createPaymentSource({
    cardToken: badToken,
    acceptanceToken: tokens.termsToken,
    personalDataToken: tokens.personalDataToken,
    email: 'qa-tradinglab@example.com',
  });
  const badCharge = await chargePaymentSource({
    paymentSourceId: badSource.wompiId,
    amountInCents: 5_000_00,
    reference: `tl_qadec_${Date.now().toString(36)}`,
    email: 'qa-tradinglab@example.com',
  });
  console.log('  fuente creada, cobro ->', badCharge.status, badCharge.statusMessage ?? '');
} catch (error) {
  console.log('  bloqueado antes de cobrar:', (error as Error).message);
}

console.log('\n✔ Recorrido completo contra el sandbox de Wompi.');
