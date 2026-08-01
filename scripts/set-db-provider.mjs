/**
 * Fija el proveedor de base de datos en prisma/schema.prisma.
 *
 * Prisma no admite `provider = env(...)`: el valor debe ser literal. En lugar de
 * mantener dos esquemas duplicados —con el riesgo de que se desincronicen— este
 * script reescribe una sola línea a partir de la variable DATABASE_PROVIDER.
 *
 *   DATABASE_PROVIDER=sqlite      → desarrollo local, sin infraestructura
 *   DATABASE_PROVIDER=postgresql  → Firebase App Hosting, Cloud SQL, Neon…
 *
 * Se ejecuta automáticamente antes de `prisma generate` (script `predb`), así
 * que en local no hay que acordarse de nada.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SUPPORTED = ['sqlite', 'postgresql', 'mysql'];

const requested = (process.env.DATABASE_PROVIDER ?? 'sqlite').trim().toLowerCase();

if (!SUPPORTED.includes(requested)) {
  console.error(
    `[set-db-provider] "${requested}" no es un proveedor admitido. Usa uno de: ${SUPPORTED.join(', ')}.`,
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, '..', 'prisma', 'schema.prisma');

const schema = readFileSync(schemaPath, 'utf8');

// Solo se toca la línea `provider` que está dentro del bloque `datasource db`,
// nunca la del generador.
const datasourceBlock = /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")([^"]+)("[^}]*?\})/s;
const match = schema.match(datasourceBlock);

if (!match) {
  console.error('[set-db-provider] No se ha encontrado el bloque `datasource db` en el esquema.');
  process.exit(1);
}

const current = match[2];

if (current === requested) {
  console.log(`[set-db-provider] El esquema ya usa "${requested}".`);
  process.exit(0);
}

writeFileSync(schemaPath, schema.replace(datasourceBlock, `$1${requested}$3`), 'utf8');
console.log(`[set-db-provider] Proveedor cambiado de "${current}" a "${requested}".`);
