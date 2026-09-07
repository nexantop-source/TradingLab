/**
 * Crea o actualiza los trabajos programados que TradingLab necesita.
 *
 *   node scripts/setup-schedulers.mjs          # muestra lo que haría
 *   node scripts/setup-schedulers.mjs --apply  # lo aplica
 *
 * Sin estos trabajos hay dos funciones que existen en el código pero que nadie
 * dispara nunca: el recordatorio de estudio y, más grave, el cobro al vencer la
 * prueba gratuita. Una prueba que caduca y no cobra no es un error visible -no
 * falla nada, no hay traza- pero regala el producto en silencio.
 *
 * Ambos comparten `PUSH_DISPATCH_SECRET`, que viaja en la cabecera del trabajo:
 * las rutas lo comparan en tiempo constante y sin él responden 503 en lugar de
 * quedar abiertas.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

const PROJECT = 'nexant-87204';
const LOCATION = 'us-east4';
const BASE_URL = 'https://tradinglab--nexant-87204.us-east4.hosted.app';

const config = parseEnv(readFileSync(new URL('../.env.wompi.local', import.meta.url), 'utf8'));
const secret = config.PUSH_DISPATCH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('Falta PUSH_DISPATCH_SECRET en .env.wompi.local. No se crea ningún trabajo.');
}

const JOBS = [
  {
    id: 'tradinglab-charge-due',
    path: '/api/billing/charge-due',
    // Cada hora en punto. El cobro no necesita más precisión: la fecha de
    // vencimiento se fijó al aceptar el mandato y cobrar unos minutos después
    // es correcto; cobrar unos minutos antes, no.
    schedule: '5 * * * *',
    description: 'Cobra las suscripciones cuya prueba gratuita ha vencido.',
  },
  {
    id: 'tradinglab-study-reminders',
    path: '/api/push/dispatch',
    // Cada hora, porque cada ejecución solo avisa a quien tiene esa hora como
    // preferida en su zona horaria. Las 24 cubren el mundo sin despertar a
    // nadie de madrugada.
    schedule: '0 * * * *',
    description: 'Recordatorio diario de estudio a quien lo pidió y hoy no ha estudiado.',
  },
];

function accessToken() {
  const path = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  const { tokens } = JSON.parse(readFileSync(path, 'utf8'));
  if (!tokens?.access_token) throw new Error('No hay sesión de Firebase. Ejecuta `firebase login`.');
  if (tokens.expires_at && tokens.expires_at < Date.now() + 60_000) {
    throw new Error('El token de la CLI ha caducado. Ejecuta cualquier comando de firebase para renovarlo.');
  }
  return tokens.access_token;
}

const token = accessToken();
const parent = `projects/${PROJECT}/locations/${LOCATION}`;
const apply = process.argv.includes('--apply');

async function api(method, path, body) {
  const response = await fetch(`https://cloudscheduler.googleapis.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, body: text ? JSON.parse(text) : null };
}

for (const job of JOBS) {
  const name = `${parent}/jobs/${job.id}`;
  const definition = {
    name,
    description: job.description,
    schedule: job.schedule,
    timeZone: 'Etc/UTC',
    httpTarget: {
      uri: `${BASE_URL}${job.path}`,
      httpMethod: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: Buffer.from('{}').toString('base64'),
    },
    // Un fallo puntual no debe perder una ejecución, pero tampoco reintentar
    // sin fin: el cobro tiene su propio control de intentos en la aplicación.
    retryConfig: { retryCount: 3, minBackoffDuration: '30s', maxBackoffDuration: '300s' },
    attemptDeadline: '300s',
  };

  const existing = await api('GET', name);
  const action = existing.ok ? 'actualizar' : 'crear';
  console.log(`${action.padEnd(10)} ${job.id.padEnd(28)} ${job.schedule.padEnd(12)} → ${job.path}`);

  if (!apply) continue;

  const result = existing.ok
    ? await api('PATCH', `${name}?updateMask=description,schedule,timeZone,httpTarget,retryConfig,attemptDeadline`, definition)
    : await api('POST', `${parent}/jobs`, definition);

  if (!result.ok) {
    // El cuerpo puede contener la cabecera con el secreto: solo se muestra el
    // mensaje de error, nunca la respuesta completa.
    throw new Error(`No se pudo ${action} ${job.id}: HTTP ${result.status} ${result.body?.error?.message ?? ''}`);
  }
  console.log(`           ${result.body.state}`);
}

console.log(apply ? '\nTrabajos aplicados.' : '\nEjecución en seco. Añade --apply para aplicarlos.');
