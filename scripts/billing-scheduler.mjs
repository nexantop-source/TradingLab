/**
 * Crea o actualiza el trabajo de Cloud Scheduler que cobra las pruebas vencidas.
 *
 * Es el único punto donde una prueba gratuita se convierte en una suscripción
 * de pago. Sin él las pruebas vencen, dejan de conceder acceso y se quedan ahí:
 * nadie cobra y nadie se entera, porque un cobro que no sale no produce ningún
 * síntoma visible.
 *
 *   node scripts/billing-scheduler.mjs            → muestra qué haría
 *   node scripts/billing-scheduler.mjs --aplicar  → lo crea o lo actualiza
 *   node scripts/billing-scheduler.mjs --ejecutar → lo lanza ahora, una vez
 *
 * Lee la credencial desde Secret Manager y la escribe en la cabecera del
 * trabajo sin pasarla nunca por la terminal ni por un fichero. Requiere haber
 * iniciado sesión con `firebase login`; el mismo camino que `db-remote.mjs`.
 *
 * El razonamiento detrás de la hora y de los reintentos está en
 * `docs/BILLING-SCHEDULER.md`.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = process.env.GCP_PROJECT ?? 'nexant-87204';
const LOCATION = process.env.GCP_REGION ?? 'us-east4';
const JOB = 'tradinglab-cobros-vencidos';
const SECRET = process.env.DISPATCH_SECRET_NAME ?? 'TRADINGLAB_PUSH_DISPATCH_SECRET';
const APP = process.env.APP_URL ?? 'https://tradinglab--nexant-87204.us-east4.hosted.app';

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
const api = (path, init = {}) =>
  fetch(`https://cloudscheduler.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });

async function dispatchSecret() {
  const response = await fetch(
    `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${SECRET}/versions/latest:access`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new Error(`No se pudo leer ${SECRET} (${response.status}). ¿Existe y tienes acceso?`);
  }
  const { payload } = await response.json();
  const value = Buffer.from(payload.data, 'base64').toString('utf8').trim();
  if (value.length < 32) {
    throw new Error(`${SECRET} tiene ${value.length} caracteres. La ruta de cobro exige al menos 32.`);
  }
  return value;
}

/**
 * La definición del trabajo.
 *
 * `13:20` hora de Bogotá: después de la apertura de los mercados y no en punto,
 * que es cuando programa todo el mundo. Una vez al día basta porque el
 * vencimiento se decide por fecha; ejecutar más a menudo no adelanta ningún
 * cobro y solo multiplica las ocasiones de cobrar dos veces si algo va mal.
 *
 * Los reintentos esperan cada vez más porque un tiempo de espera agotado es
 * ambiguo -la petición salió, la respuesta se perdió- y el servicio ya marca la
 * fecha de cobro como consumida antes de responder: reintentar no vuelve a
 * cobrar, pero insistir sobre un incidente que aún dura no ayuda a nadie.
 */
function definition(secret) {
  return {
    name: `projects/${PROJECT}/locations/${LOCATION}/jobs/${JOB}`,
    description: 'Cobra las suscripciones cuya prueba gratuita ha vencido. Ver docs/BILLING-SCHEDULER.md',
    schedule: '20 13 * * *',
    timeZone: 'America/Bogota',
    attemptDeadline: '540s',
    retryConfig: {
      retryCount: 3,
      minBackoffDuration: '60s',
      maxBackoffDuration: '600s',
      maxDoublings: 2,
    },
    httpTarget: {
      uri: `${APP}/api/billing/charge-due`,
      httpMethod: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: Buffer.from('{}', 'utf8').toString('base64'),
    },
  };
}

/** Lo mismo que se enviaría, pero sin la credencial. Para poder enseñarlo. */
function redacted(job) {
  return {
    ...job,
    httpTarget: { ...job.httpTarget, headers: { ...job.httpTarget.headers, Authorization: 'Bearer «···»' } },
  };
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const ejecutar = process.argv.includes('--ejecutar');

  const existing = await api(`/jobs/${JOB}`);
  const exists = existing.status === 200;

  if (ejecutar) {
    if (!exists) throw new Error(`El trabajo ${JOB} no existe todavía. Créalo con --aplicar.`);
    const run = await api(`/jobs/${JOB}:run`, { method: 'POST', body: '{}' });
    console.log(run.ok ? '▸ Lanzado. El informe queda en los registros del servicio.' : `✖ No se pudo lanzar (${run.status}).`);
    if (!run.ok) console.error((await run.text()).slice(0, 400));
    return;
  }

  const secret = await dispatchSecret();
  const job = definition(secret);

  if (!aplicar) {
    console.log(exists ? `El trabajo ${JOB} ya existe. Con --aplicar se actualizaría a:` : `El trabajo ${JOB} no existe. Con --aplicar se crearía:`);
    console.log(JSON.stringify(redacted(job), null, 2));
    if (exists) {
      const current = await existing.json();
      console.log(`\nEstado actual: ${current.state ?? '?'} · última ejecución: ${current.lastAttemptTime ?? 'nunca'}`);
    }
    return;
  }

  const response = exists
    ? await api(`/jobs/${JOB}?updateMask=schedule,timeZone,description,attemptDeadline,retryConfig,httpTarget`, {
        method: 'PATCH',
        body: JSON.stringify(job),
      })
    : await api('/jobs', { method: 'POST', body: JSON.stringify(job) });

  if (!response.ok) {
    console.error(`✖ ${exists ? 'No se pudo actualizar' : 'No se pudo crear'} el trabajo (${response.status}).`);
    console.error((await response.text()).slice(0, 600));
    process.exitCode = 1;
    return;
  }

  const created = await response.json();
  console.log(`✔ ${exists ? 'Actualizado' : 'Creado'}: ${created.name}`);
  console.log(`   ${created.schedule} (${created.timeZone}) → ${created.httpTarget?.uri}`);
  console.log(`   estado: ${created.state ?? 'ENABLED'}`);
  console.log('\n   Para probarlo ahora: node scripts/billing-scheduler.mjs --ejecutar');
}

main().catch((error) => {
  console.error('✖', error.message);
  process.exitCode = 1;
});
