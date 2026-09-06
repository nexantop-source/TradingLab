import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ConfigurationError, ForbiddenError, UnauthorizedError } from './auth';
import { RateLimitError } from './rate-limit';
import { SimulationError } from '@tl/simulation-engine';
import { LedgerError } from '@tl/simulation-engine';
import { MarketDataError } from '@tl/market-data';
import { AIUnavailableError } from '@tl/ai';

/**
 * Respuestas normalizadas de la API.
 * Todo endpoint devuelve `{ ok: true, data }` o `{ ok: false, error }`.
 */

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message, details } }, { status });
}

/**
 * Traduce cualquier excepción a una respuesta HTTP.
 * Nunca filtra trazas ni mensajes internos al cliente en producción.
 */
export function handleError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return fail(
      'VALIDATION_ERROR',
      'Los datos enviados no son válidos.',
      422,
      error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  // Prisma no falla al construir el cliente sin DATABASE_URL: falla en la
  // primera consulta. Se traduce a un 503 explicativo en lugar de un 500
  // opaco, porque el problema está en el despliegue y no en la petición.
  if (error instanceof Error && error.name === 'PrismaClientInitializationError') {
    console.error('[db] No se ha podido conectar con la base de datos:', error.message);
    return fail(
      'DATABASE_NOT_CONFIGURED',
      'El servicio no puede conectar con su base de datos, así que esta acción no está disponible. Si administras esta instalación, revisa DATABASE_URL.',
      503,
    );
  }
  // El despliegue construye y genera el cliente de Prisma, pero no aplica el
  // esquema: eso se hace aparte con `scripts/db-remote.mjs push`. Si se olvida,
  // el cliente pide columnas que la base todavía no tiene y falla **toda**
  // petición autenticada, porque `getAuth` carga el perfil y la suscripción
  // enteros. Sin este caso el síntoma es una aplicación en blanco tras iniciar
  // sesión y un 500 opaco; con él, el registro dice exactamente qué ejecutar.
  if (isSchemaDrift(error)) {
    console.error(
      '[db] El esquema de la base desplegada está desactualizado. Ejecuta `node scripts/db-remote.mjs push`.',
      (error as { meta?: unknown }).meta ?? (error as Error).message,
    );
    return fail(
      'DATABASE_SCHEMA_OUTDATED',
      'La base de datos de este despliegue no está actualizada al esquema de la aplicación. Si administras esta instalación, aplica el esquema con `node scripts/db-remote.mjs push`.',
      503,
    );
  }
  if (error instanceof ConfigurationError) {
    // Se registra como error del servidor porque requiere intervención de quien
    // administra el despliegue, no del usuario.
    console.error('[config]', error.message);
    return fail('SERVICE_NOT_CONFIGURED', error.message, 503);
  }
  if (error instanceof UnauthorizedError) return fail('UNAUTHORIZED', error.message, 401);
  if (error instanceof ForbiddenError) return fail('FORBIDDEN', error.message, 403);
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { ok: false, error: { code: 'RATE_LIMITED', message: error.message } },
      { status: 429, headers: { 'Retry-After': String(error.result.retryAfterSeconds) } },
    );
  }
  if (error instanceof SimulationError) return fail(`SIMULATION_${error.code}`, error.message, 400);
  if (error instanceof LedgerError) return fail(`LEDGER_${error.code}`, error.message, 400);
  if (error instanceof MarketDataError) {
    const status = error.code === 'UNKNOWN_SYMBOL' ? 404 : error.code === 'RATE_LIMITED' ? 429 : 502;
    return fail(`MARKET_DATA_${error.code}`, error.message, status);
  }
  if (error instanceof AIUnavailableError) {
    return fail('AI_UNAVAILABLE', error.message, 503);
  }

  console.error('[api] Error no controlado:', error);
  return fail(
    'INTERNAL_ERROR',
    'Ha ocurrido un error inesperado. Si persiste, contacta con soporte.',
    500,
  );
}

/** Extrae la IP del cliente respetando las cabeceras del proxy. */
export function clientIp(req: Request): string | null {
  const h = req.headers;
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return h.get('x-real-ip');
}

/** Detección de dispositivo para segmentación publicitaria y telemetría. */
export function detectDevice(userAgent: string | null): 'desktop' | 'mobile' | 'tablet' {
  if (!userAgent) return 'desktop';
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Distingue «la base no está al día con el esquema» de un error de consulta.
 *
 * P2021 (tabla inexistente) y P2022 (columna inexistente) solo ocurren cuando
 * el cliente generado va por delante de la base. Es un fallo de despliegue, no
 * de la petición, y por eso merece un mensaje que diga qué ejecutar.
 */
function isSchemaDrift(error: unknown): boolean {
  const code = (error as { code?: unknown }).code;
  if (code === 'P2021' || code === 'P2022') return true;
  // Prisma no siempre adjunta el código en errores crudos o de conexión
  // agrupada; el mensaje sí es estable.
  const message = error instanceof Error ? error.message : '';
  return /does not exist in the current database|column .* does not exist|relation .* does not exist/i.test(message);
}
