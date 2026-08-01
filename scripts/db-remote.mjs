/**
 * Ejecuta un comando de Prisma contra la base de datos desplegada, leyendo la
 * cadena de conexión desde Secret Manager.
 *
 * Evita el patrón habitual de pegar la contraseña en la terminal o dejarla en
 * un `.env` que acaba versionado por descuido: el valor solo vive en memoria
 * durante la ejecución y nunca se imprime.
 *
 *   node scripts/db-remote.mjs push      → crea o actualiza las tablas
 *   node scripts/db-remote.mjs migrate   → aplica migraciones pendientes
 *   node scripts/db-remote.mjs seed      → carga el catálogo y los datos demo
 *   node scripts/db-remote.mjs studio    → abre el inspector contra la base real
 *
 * Requiere haber iniciado sesión con `firebase login`.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const PROJECT = process.env.GCP_PROJECT ?? 'nexant-87204';
const SECRET = process.env.DB_SECRET ?? 'DATABASE_URL';

const COMMANDS = {
  push: ['npx', ['prisma', 'db', 'push']],
  migrate: ['npx', ['prisma', 'migrate', 'deploy']],
  seed: ['npx', ['tsx', 'prisma/seed.ts']],
  studio: ['npx', ['prisma', 'studio']],
};

const action = process.argv[2];

if (!action || !COMMANDS[action]) {
  console.error(`Uso: node scripts/db-remote.mjs <${Object.keys(COMMANDS).join('|')}>`);
  process.exit(1);
}

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

const [bin, args] = COMMANDS[action];
console.error(`▸ Ejecutando "${action}" contra la base de ${PROJECT}…`);

// El esquema debe declarar postgresql antes de que Prisma lo lea.
spawnSync(process.execPath, ['scripts/set-db-provider.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_PROVIDER: 'postgresql' },
});

const result = spawnSync(bin, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, DATABASE_URL: databaseUrl, DATABASE_PROVIDER: 'postgresql' },
});

// Se devuelve el esquema a sqlite para no dejar el repositorio en un estado
// distinto del que espera el desarrollo local.
spawnSync(process.execPath, ['scripts/set-db-provider.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_PROVIDER: 'sqlite' },
});

process.exit(result.status ?? 1);
