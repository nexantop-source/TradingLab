/**
 * Comprueba, contra el sandbox real, si Wompi deja **verificar** una tarjeta:
 * cobrarle un importe mínimo y devolverlo enseguida.
 *
 * Es la pregunta que decide el diseño de la prueba gratuita. Guardar una
 * tarjeta con `payment_sources` no dice nada sobre si se le puede cobrar: el
 * token es válido, la fuente queda `AVAILABLE` y siete días después el primer
 * cobro real puede fallar igualmente. Un cobro de verdad, por pequeño que sea,
 * sí lo dice.
 *
 *   node --conditions=react-server --import tsx scripts/qa-wompi-verification.mts
 *
 * Se niega a correr fuera de sandbox.
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.wompi.sandbox.local', 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^"|"$/g, '')];
    }),
);

if (env.WOMPI_ENVIRONMENT !== 'sandbox') {
  console.error('Solo contra sandbox.');
  process.exit(1);
}

const API = 'https://sandbox.wompi.co/v1';
const PUB = env.WOMPI_PUBLIC_KEY;
const PRV = env.WOMPI_PRIVATE_KEY;

async function call(path: string, init: RequestInit & { key?: string } = {}) {
  const { key, ...rest } = init;
  const response = await fetch(`${API}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

const { createHash } = await import('node:crypto');

/** Los tokens de aceptación son de un solo uso: se piden frescos cada vez. */
async function freshTokens() {
  const merchant = await call(`/merchants/${PUB}`);
  return {
    acceptance: merchant.body?.data?.presigned_acceptance?.acceptance_token,
    personal: merchant.body?.data?.presigned_personal_data_auth?.acceptance_token,
  };
}

/** Prueba una tarjeta de principio a fin: token, fuente, cobro mínimo y anulación. */
async function probe(label: string, number: string) {
  console.log(`
▸ ${label} (${number})`);
  const { acceptance, personal } = await freshTokens();
  const tokenized = await call('/tokens/cards', {
    method: 'POST',
    key: PUB,
    body: JSON.stringify({ number, exp_month: '12', exp_year: '31', cvc: '123', card_holder: 'QA TradingLab' }),
  });
  const cardToken = tokenized.body?.data?.id;
  if (!cardToken) return console.log('   tokenización rechazada:', JSON.stringify(tokenized.body).slice(0, 160));

  const source = await call('/payment_sources', {
    method: 'POST',
    key: PRV,
    body: JSON.stringify({
      type: 'CARD', token: cardToken, customer_email: 'qa-verificacion@tradinglab.example',
      acceptance_token: acceptance, accept_personal_auth: personal,
    }),
  });
  const sourceId = source.body?.data?.id;
  console.log('   fuente de pago:', source.body?.data?.status ?? JSON.stringify(source.body).slice(0, 160));
  if (!sourceId) return;

  const amount = 150000;
  const reference = `qa-verif-${Date.now()}`;
  const signature = createHash('sha256').update(`${reference}${amount}COP${env.WOMPI_INTEGRITY_SECRET}`).digest('hex');
  const charged = await call('/transactions', {
    method: 'POST', key: PRV,
    body: JSON.stringify({
      amount_in_cents: amount, currency: 'COP', customer_email: 'qa-verificacion@tradinglab.example',
      reference, payment_source_id: sourceId, signature, payment_method: { installments: 1 }, recurrent: false,
    }),
  });
  const id = charged.body?.data?.id;
  if (!id) return console.log('   cobro rechazado:', JSON.stringify(charged.body).slice(0, 200));

  let status = charged.body.data.status;
  for (let i = 0; i < 12 && status === 'PENDING'; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const check = await call(`/transactions/${id}`, { key: PRV });
    status = check.body?.data?.status;
  }
  console.log('   verificación:', status, charged.body?.data?.status_message ?? '');
  if (status !== 'APPROVED') return;

  const voided = await call(`/transactions/${id}/void`, { method: 'POST', key: PRV });
  console.log('   anulada:', voided.status === 201 ? 'sí' : `no (${voided.status})`);
}

// Tarjetas de prueba de Wompi. La primera aprueba, las otras deben fallar.
await probe('APPROVED', '4242424242424242');
await probe('DECLINED', '4111111111111111');
await probe('Mastercard', '5254133674403564');
