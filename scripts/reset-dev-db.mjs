/**
 * Borra la base de datos SQLite de desarrollo para poder recrearla desde cero.
 *
 * Se hace así, y no con `prisma db push --force-reset`, por una razón concreta:
 * ese comando también borraría una base de datos remota si `DATABASE_URL`
 * apunta a producción por error. Este script solo actúa sobre un archivo local
 * y se niega a ejecutarse contra cualquier otro proveedor.
 */
import { existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';

const url = process.env.DATABASE_URL ?? 'file:./dev.db';

if (!url.startsWith('file:')) {
  console.error(
    '[reset-dev-db] DATABASE_URL no apunta a un archivo SQLite local. Este script solo borra bases de datos de desarrollo.\n' +
      'Para recrear una base remota, hazlo de forma explícita con las herramientas de tu proveedor.',
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const relative = url.replace(/^file:/, '');
const dbPath = isAbsolute(relative) ? relative : join(here, '..', 'prisma', relative.replace(/^\.\//, ''));

let removed = 0;
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  const target = `${dbPath}${suffix}`;
  if (existsSync(target)) {
    unlinkSync(target);
    removed++;
  }
}

console.log(
  removed > 0
    ? `[reset-dev-db] Base de datos de desarrollo eliminada (${removed} archivo(s)).`
    : '[reset-dev-db] No había base de datos que borrar.',
);
