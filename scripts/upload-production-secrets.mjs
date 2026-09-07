/**
 * Sube a Secret Manager los secretos de producción que la aplicación necesita
 * en tiempo de ejecución, y concede acceso al backend.
 *
 *   node scripts/upload-production-secrets.mjs          # solo valida, no sube
 *   node scripts/upload-production-secrets.mjs --apply  # sube y concede acceso
 *
 * Sustituye a `upload-wompi-secrets.mjs`, que solo cubría las tres credenciales
 * del Checkout Web. Desde que existe la prueba gratuita hacen falta también la
 * llave privada de Wompi -sin ella no se puede cobrar una tarjeta guardada- y
 * los secretos de datos de mercado y notificaciones.
 *
 * Los valores viajan por stdin, nunca como argumentos de shell ni por consola:
 * los argumentos quedan en el historial y en la lista de procesos.
 */
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = parseEnv(readFileSync(new URL('../.env.wompi.local', import.meta.url), 'utf8'));

/**
 * Cada secreto declara con qué debe empezar su valor. Es lo que impide subir
 * una credencial de sandbox al backend que mueve dinero real: un despliegue con
 * llaves cruzadas es indistinguible de uno correcto hasta que alguien paga.
 */
const SECRETS = [
  ['WOMPI_PUBLIC_KEY', /^pub_prod_[A-Za-z0-9]+$/],
  ['WOMPI_PRIVATE_KEY', /^prv_prod_[A-Za-z0-9]+$/],
  ['WOMPI_INTEGRITY_SECRET', /^prod_integrity_[A-Za-z0-9]+$/],
  ['WOMPI_EVENTS_SECRET', /^prod_events_[A-Za-z0-9]+$/],
  ['FINNHUB_API_KEY', /^[a-z0-9]{20,}$/],
  ['VAPID_PUBLIC_KEY', /^[A-Za-z0-9_-]{80,}$/],
  ['VAPID_PRIVATE_KEY', /^[A-Za-z0-9_-]{40,}$/],
  ['PUSH_DISPATCH_SECRET', /^[A-Za-z0-9_-]{32,}$/],
];

const extra = process.argv.slice(2).filter((arg) => arg !== '--apply');
if (extra.length > 0) {
  throw new Error('Solo se admite --apply. Sin esa bandera el script no escribe nada.');
}

if (config.WOMPI_ENVIRONMENT !== 'production') {
  throw new Error('.env.wompi.local no contiene credenciales de producción. No se sube nada.');
}

const missing = SECRETS.filter(([key, pattern]) => !pattern.test(config[key] ?? ''));
if (missing.length > 0) {
  throw new Error(
    `Faltan o no son válidos: ${missing.map(([key]) => key).join(', ')}. No se ha subido ninguna credencial.`,
  );
}

console.log(`${SECRETS.length} credenciales de producción validadas localmente.`);
if (!process.argv.includes('--apply')) {
  console.log('Ejecución en seco. Añade --apply para subirlas.');
  process.exit(0);
}

const common = ['--project', 'nexant-87204', '--non-interactive'];

function firebase(args, input) {
  const result = spawnSync('npx', ['--yes', 'firebase-tools@15.24.0', ...args, ...common], {
    cwd: root,
    shell: process.platform === 'win32',
    input,
    encoding: 'utf8',
    timeout: 300_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  // La salida cruda puede contener el propio valor: no se imprime nunca.
  if (result.error || result.status !== 0) {
    throw new Error(
      `Firebase ${args[0]} falló (código ${result.status ?? 'desconocido'}). Los pasos anteriores pueden haberse aplicado.`,
    );
  }
}

for (const [key] of SECRETS) {
  const secret = `TRADINGLAB_${key}`;
  firebase(['apphosting:secrets:set', secret, '--data-file', '-', '--force'], config[key]);
  console.log(`Subido ${secret}.`);
}

firebase([
  'apphosting:secrets:grantaccess',
  SECRETS.map(([key]) => `TRADINGLAB_${key}`).join(','),
  '--backend',
  'tradinglab',
]);

console.log('Acceso concedido al backend tradinglab.');
console.log('Recuerda: los secretos solo llegan al servicio en el siguiente despliegue.');
