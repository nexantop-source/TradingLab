import 'server-only';
import { db } from './db';

/**
 * Limitación de frecuencia respaldada por base de datos.
 *
 * En producción con varias instancias conviene sustituir el contador por Redis
 * (`docs/DEPLOYMENT.md` explica el cambio: solo hay que reimplementar
 * `consume`). Se usa la base de datos para que el repositorio funcione sin
 * infraestructura adicional.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

export async function consume(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const bucket = Math.floor(now.getTime() / (windowSeconds * 1000));
  const id = `${key}:${bucket}`;
  const resetAt = new Date((bucket + 1) * windowSeconds * 1000);

  const row = await db.rateLimitCounter.upsert({
    where: { id },
    create: { id, count: 1, expiresAt: resetAt },
    update: { count: { increment: 1 } },
  });

  const allowed = row.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - row.count),
    limit,
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
  };
}

/** Limpieza de contadores vencidos. Se invoca de forma oportunista. */
export async function pruneExpired(): Promise<void> {
  await db.rateLimitCounter.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

/** Límites por familia de endpoints. */
export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 3600 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
  ai: { limit: 20, windowSeconds: 300 },
  simulationCreate: { limit: 40, windowSeconds: 300 },
  marketData: { limit: 240, windowSeconds: 60 },
  adEvent: { limit: 120, windowSeconds: 60 },
  general: { limit: 300, windowSeconds: 60 },
} as const;

export class RateLimitError extends Error {
  readonly status = 429;
  constructor(readonly result: RateLimitResult) {
    super(
      `Has realizado demasiadas solicitudes. Vuelve a intentarlo en ${result.retryAfterSeconds} segundos.`,
    );
    this.name = 'RateLimitError';
  }
}

export async function enforce(
  key: string,
  config: { limit: number; windowSeconds: number },
): Promise<void> {
  const result = await consume(key, config.limit, config.windowSeconds);
  if (!result.allowed) throw new RateLimitError(result);
}
