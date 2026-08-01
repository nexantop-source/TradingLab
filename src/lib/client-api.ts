'use client';

/**
 * Cliente HTTP del navegador.
 *
 * Normaliza el manejo de errores para que cada formulario no tenga que
 * repetirlo, y devuelve mensajes ya redactados para mostrar al usuario.
 */

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ path: string; message: string }> | unknown;
}

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  /** Errores por campo, listos para pintar bajo cada input. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as Array<{ path?: string; message?: string }>) {
        if (d.path && d.message) out[d.path] = d.message;
      }
    }
    return out;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};

  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...rest.headers,
    },
    body: json ? JSON.stringify(json) : rest.body,
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    throw new ApiRequestError(
      'INVALID_RESPONSE',
      'La respuesta del servidor no se pudo interpretar. Inténtalo de nuevo.',
      res.status,
    );
  }

  const body = payload as { ok?: boolean; data?: T; error?: ApiError };

  if (!res.ok || !body.ok) {
    throw new ApiRequestError(
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? 'Ha ocurrido un error inesperado.',
      res.status,
      body.error?.details,
    );
  }

  return body.data as T;
}

/** Clave de idempotencia para operaciones de pago. */
export function idempotencyKey(): string {
  return `idem_${crypto.randomUUID()}`;
}
