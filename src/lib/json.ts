/**
 * Serialización de campos JSON.
 *
 * El esquema guarda JSON como `String` para que funcione igual en SQLite y en
 * PostgreSQL. Estos ayudantes evitan repetir el try/catch y garantizan que un
 * dato corrupto no tumbe una página entera.
 */

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function fromJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}
