/**
 * Aprovisiona una instancia de Cloud SQL for PostgreSQL en el proyecto de
 * Firebase, usando las credenciales que ya tiene guardadas la CLI.
 *
 * Se escribe como script y no como una serie de comandos sueltos porque la
 * operación es larga (varios minutos), hay que sondear su estado y conviene
 * poder repetirla si falla a medias: cada paso comprueba antes si ya existe.
 *
 *   node scripts/provision-cloudsql.mjs
 *
 * Requiere haber iniciado sesión con `firebase login`. No imprime nunca la
 * contraseña ni el token de acceso.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const PROJECT = process.env.GCP_PROJECT ?? 'nexant-87204';
const REGION = process.env.GCP_REGION ?? 'us-east4';
const INSTANCE = process.env.SQL_INSTANCE ?? 'tradinglab-db';
const DB_NAME = 'tradinglab';
const DB_USER = 'tradinglab';
const TIER = process.env.SQL_TIER ?? 'db-f1-micro';

const SQL = 'https://sqladmin.googleapis.com/v1';

/**
 * Todo el progreso va a stderr. stdout queda reservado para la cadena de
 * conexión, de modo que el script se pueda canalizar directamente a
 * `firebase apphosting:secrets:set --data-file -` sin que los mensajes
 * contaminen el valor del secreto.
 */
const log = (...parts) => process.stderr.write(`${parts.join(' ')}\n`);
const logErr = (...parts) => process.stderr.write(`${parts.join(' ')}\n`);

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

async function api(method, path, body) {
  const res = await fetch(`${SQL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta no JSON */
  }
  return { ok: res.ok, status: res.status, json, text };
}

/** Espera a que termine una operación de larga duración de Cloud SQL. */
async function waitFor(operationName, label) {
  process.stderr.write(`  ${label}`);
  for (let i = 0; i < 120; i++) {
    const { json } = await api('GET', `/projects/${PROJECT}/operations/${operationName}`);
    if (json?.status === 'DONE') {
      process.stderr.write('\n');
      if (json.error) {
        throw new Error(`${label} falló: ${JSON.stringify(json.error.errors ?? json.error)}`);
      }
      return;
    }
    process.stderr.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`${label}: se agotó la espera.`);
}

// ── 1. Instancia ─────────────────────────────────────────────────────────────

const existing = await api('GET', `/projects/${PROJECT}/instances/${INSTANCE}`);

if (existing.ok) {
  log(`▸ La instancia "${INSTANCE}" ya existe, se reutiliza.`);
} else if (existing.status === 404) {
  log(`▸ Creando la instancia "${INSTANCE}" (${TIER}, PostgreSQL 16, ${REGION})…`);
  const created = await api('POST', `/projects/${PROJECT}/instances`, {
    name: INSTANCE,
    region: REGION,
    databaseVersion: 'POSTGRES_16',
    settings: {
      tier: TIER,
      edition: 'ENTERPRISE',
      availabilityType: 'ZONAL',
      dataDiskSizeGb: '10',
      dataDiskType: 'PD_SSD',
      storageAutoResize: true,
      deletionProtectionEnabled: false,
      backupConfiguration: {
        enabled: true,
        startTime: '04:00',
        pointInTimeRecoveryEnabled: false,
      },
      ipConfiguration: {
        // App Hosting no expone conexión por socket a Cloud SQL, así que la
        // instancia necesita IP pública. Se exige TLS: una conexión sin cifrar
        // se rechaza en el servidor, no solo por convención del cliente.
        ipv4Enabled: true,
        sslMode: 'ENCRYPTED_ONLY',
        authorizedNetworks: [
          {
            name: 'cloud-run-app-hosting',
            // Cloud Run sale por direcciones dinámicas, así que no hay un rango
            // que autorizar. Ver la nota de seguridad en docs/FIREBASE.md.
            value: '0.0.0.0/0',
          },
        ],
      },
    },
  });

  if (!created.ok) {
    console.error('✖ No se pudo crear la instancia:');
    console.error(created.text.slice(0, 1200));
    process.exit(1);
  }

  await waitFor(created.json.name, 'Aprovisionando (tarda varios minutos)');
  log('  ✓ Instancia lista.');
} else {
  logErr(`✖ Error consultando la instancia (${existing.status}):`);
  logErr(existing.text.slice(0, 800));
  process.exit(1);
}

// ── 2. Base de datos ─────────────────────────────────────────────────────────

const dbExists = await api('GET', `/projects/${PROJECT}/instances/${INSTANCE}/databases/${DB_NAME}`);

if (dbExists.ok) {
  log(`▸ La base "${DB_NAME}" ya existe.`);
} else {
  log(`▸ Creando la base "${DB_NAME}"…`);
  const r = await api('POST', `/projects/${PROJECT}/instances/${INSTANCE}/databases`, {
    name: DB_NAME,
    instance: INSTANCE,
    project: PROJECT,
  });
  if (!r.ok) {
    console.error('✖ No se pudo crear la base:', r.text.slice(0, 600));
    process.exit(1);
  }
  await waitFor(r.json.name, 'Creando base');
  log('  ✓ Base creada.');
}

// ── 3. Usuario ───────────────────────────────────────────────────────────────

// Sin caracteres que compliquen la cadena de conexión ni el copiado manual.
const password = randomBytes(32).toString('base64url');

log(`▸ Configurando el usuario "${DB_USER}"…`);
const users = await api('GET', `/projects/${PROJECT}/instances/${INSTANCE}/users`);
const userExists = users.json?.items?.some((u) => u.name === DB_USER);

const userOp = userExists
  ? await api('PUT', `/projects/${PROJECT}/instances/${INSTANCE}/users?name=${DB_USER}`, {
      name: DB_USER,
      password,
    })
  : await api('POST', `/projects/${PROJECT}/instances/${INSTANCE}/users`, {
      name: DB_USER,
      password,
    });

if (!userOp.ok) {
  logErr('✖ No se pudo configurar el usuario:', userOp.text.slice(0, 600));
  process.exit(1);
}
await waitFor(userOp.json.name, userExists ? 'Actualizando contraseña' : 'Creando usuario');
log('  ✓ Usuario listo.');

// ── 4. Cadena de conexión ────────────────────────────────────────────────────

const info = await api('GET', `/projects/${PROJECT}/instances/${INSTANCE}`);
const ip = info.json?.ipAddresses?.find((a) => a.type === 'PRIMARY')?.ipAddress;

if (!ip) {
  logErr('✖ La instancia no tiene IP pública asignada todavía. Vuelve a ejecutar el script.');
  process.exit(1);
}

const url = `postgresql://${DB_USER}:${encodeURIComponent(password)}@${ip}:5432/${DB_NAME}?sslmode=require`;

// Se escribe en stdout sin adornos para poder canalizarlo directamente a
// `firebase apphosting:secrets:set --data-file -`, sin pasar por un archivo.
if (process.env.PRINT_URL === '1') {
  process.stdout.write(url);
} else {
  log('');
  log(`✔ Cloud SQL preparado en ${PROJECT}.`);
  log(`  Instancia : ${INSTANCE} (${REGION})`);
  log(`  IP pública: ${ip}`);
  log(`  Base      : ${DB_NAME}   Usuario: ${DB_USER}`);
  log('');
  log('  La cadena de conexión NO se imprime a propósito. Para guardarla como secreto:');
  log('    PRINT_URL=1 node scripts/provision-cloudsql.mjs | firebase apphosting:secrets:set DATABASE_URL --data-file -');
}
