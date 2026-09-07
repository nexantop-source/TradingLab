/**
 * Muestra, sin aplicar nada, el SQL que `db-remote.mjs push` ejecutaría contra
 * la base desplegada.
 *
 * Existe porque `prisma db push` no enseña su plan antes de actuar, y aplicar a
 * ciegas cambios de esquema sobre producción es exactamente el tipo de decisión
 * que conviene poder revisar. Es de solo lectura: abre una conexión, compara y
 * cierra.
 *
 *   node scripts/db-remote-diff.mjs
 *
 * Requiere haber iniciado sesión con `firebase login`, igual que db-remote.mjs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const PROJECT = process.env.GCP_PROJECT ?? 'nexant-87204';
const SECRET = process.env.DB_SECRET ?? 'DATABASE_URL';

function accessToken() {
  const path = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  const { tokens } = JSON.parse(readFileSync(path, 'utf8'));
  if (!tokens?.access_token) throw new Error('No hay sesión de Firebase. Ejecuta `firebase login`.');
  if (tokens.expires_at && tokens.expires_at < Date.now() + 60_000) {
    throw new Error('El token de la CLI ha caducado. Ejecuta cualquier comando de firebase para renovarlo.');
  }
  return tokens.access_token;
}

const res = await fetch(
  `https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${SECRET}/versions/latest:access`,
  { headers: { Authorization: `Bearer ${accessToken()}` } },
);

if (!res.ok) {
  console.error(`✖ No se pudo leer el secreto ${SECRET} (${res.status}).`);
  console.error((await res.text()).slice(0, 400));
  process.exit(1);
}

const { payload } = await res.json();
const databaseUrl = Buffer.from(payload.data, 'base64').toString('utf8').trim();

if (!databaseUrl.startsWith('postgresql://')) {
  console.error('✖ El secreto no contiene una cadena de conexión de PostgreSQL.');
  process.exit(1);
}

// El esquema local se restaura pase lo que pase. Encadenar la salida de este
// script con `head` o `tail` lo mata por SIGPIPE antes de llegar al final, y
// dejarlo en postgresql rompe el desarrollo local con un error de validación de
// datasource que no parece tener ninguna relación con haber consultado la base
// remota.
//
// Se reescribe el fichero directamente en lugar de delegar en
// `set-db-provider.mjs`: dentro de `process.on('exit')` Node ya no permite
// crear subprocesos.
const DATASOURCE = /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")([^"]+)("[^}]*?\})/s;

function setLocalProvider(provider) {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  if (DATASOURCE.exec(schema)?.[2] === provider) return;
  writeFileSync('prisma/schema.prisma', schema.replace(DATASOURCE, `$1${provider}$3`), 'utf8');
}

function restoreLocalSchema() {
  try {
    setLocalProvider('sqlite');
  } catch {
    // Restaurar es una conveniencia: si falla, no debe enmascarar el error real.
  }
}

process.on('exit', restoreLocalSchema);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    restoreLocalSchema();
    process.exit(1);
  });
}

setLocalProvider('postgresql');

console.error(`\u25b8 Comparando la base de ${PROJECT} con prisma/schema.prisma\u2026\n`);

const result = spawnSync(
  'npx',
  [
    'prisma',
    'migrate',
    'diff',
    '--from-url',
    databaseUrl,
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ],
  { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, DATABASE_PROVIDER: 'postgresql' } },
);

restoreLocalSchema();
process.exit(result.status ?? 1);
