import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ForbiddenError, UnauthorizedError } from './auth';
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
