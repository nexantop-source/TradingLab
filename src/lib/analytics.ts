import 'server-only';
import { db } from './db';
import { toJson } from './json';
import type { AnalyticsEventName } from '@tl/analytics';

/**
 * Registro de eventos de producto.
 *
 * Se escribe en la propia base de datos para que el repositorio sea autónomo.
 * Para enviar además a un servicio externo (PostHog, Amplitude, GA4), añade la
 * llamada aquí: es el único punto de emisión.
 *
 * Nunca falla la petición del usuario por un problema de analítica.
 */
export async function track(
  name: AnalyticsEventName,
  properties: Record<string, unknown> = {},
  identity: { userId?: string | null; anonymousId?: string | null } = {},
): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: {
        name,
        properties: toJson(sanitize(properties)),
        userId: identity.userId ?? null,
        anonymousId: identity.anonymousId ?? null,
      },
    });
  } catch (error) {
    console.warn('[analytics] No se pudo registrar el evento', name, error);
  }
}

/** Retira claves que podrían contener datos personales. */
const BLOCKED_KEYS = new Set(['email', 'password', 'name', 'phone', 'ip', 'address', 'token']);

function sanitize(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (BLOCKED_KEYS.has(k.toLowerCase())) continue;
    if (typeof v === 'string' && v.length > 300) {
      out[k] = `${v.slice(0, 300)}…`;
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Escribe una entrada en el registro de auditoría administrativa. */
export async function audit(params: {
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  diff?: unknown;
  ipHash?: string | null;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        diff: toJson(params.diff ?? {}),
        ipHash: params.ipHash ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] No se pudo registrar la auditoría', params.action, error);
  }
}
