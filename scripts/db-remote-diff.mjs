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
import { readFileSync } from 'node:fs';
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

spawnSync(process.execPath, ['scripts/set-db-provider.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_PROVIDER: 'postgresql' },
});

console.error(`▸ Comparando la base de ${PROJECT} con prisma/schema.prisma…\n`);

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

spawnSync(process.execPath, ['scripts/set-db-provider.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_PROVIDER: 'sqlite' },
});

process.exit(result.status ?? 1);
