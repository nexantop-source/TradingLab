import 'server-only';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';
import type { PlanId, Role, SessionUser, ExperienceLevel, Locale } from '@tl/types';

/**
 * Autenticación por sesión.
 *
 * Diseño:
 *  · La cookie contiene un JWT firmado con el identificador de sesión. El JWT
 *    permite validar sin ir a base de datos en rutas de solo lectura, y la
 *    fila `Session` permite revocar (cierre de sesión en todos los dispositivos).
 *  · Solo se guarda el hash del token: una filtración de la base de datos no
 *    permite suplantar sesiones.
 *  · La cookie es httpOnly, sameSite=lax y secure en producción.
 */

const COOKIE_NAME = 'tl_session';
const SESSION_DAYS = 30;

const SECRET_ERROR =
  'AUTH_SECRET no está configurado o es demasiado corto. Debe tener al menos 32 caracteres. Ver .env.example y docs/FIREBASE.md.';

/** `true` si hay un secreto de sesión utilizable. */
export function authSecretConfigured(): boolean {
  const s = process.env.AUTH_SECRET;
  return Boolean(s && s.length >= 32);
}

/**
 * Secreto de firma de sesiones. Lanza si falta: crear o validar una sesión sin
 * él sería inseguro, así que se falla de forma ruidosa.
 */
function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error(SECRET_ERROR);
  return new TextEncoder().encode(s);
}

/**
 * Aviso único al arrancar sin secreto configurado.
 *
 * Sin él, `getAuth` trata a todo el mundo como anónimo en lugar de propagar la
 * excepción. Eso mantiene en pie las páginas públicas de un despliegue recién
 * creado —landing, precios, centro legal— en lugar de devolver un 500 opaco,
 * y falla de forma cerrada: nadie obtiene sesión, así que no se concede ningún
 * acceso indebido. Iniciar sesión sí devuelve un error explícito.
 */
let warnedAboutSecret = false;

function warnMissingSecret(): void {
  if (warnedAboutSecret) return;
  warnedAboutSecret = true;
  console.error(
    `[auth] ${SECRET_ERROR} Mientras tanto la aplicación funciona en modo público: ninguna sesión será válida.`,
  );
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Hash de IP para auditoría sin almacenar la dirección en claro. */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.AUTH_SECRET ?? '';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null },
): Promise<string> {
  if (!authSecretConfigured()) {
    throw new ConfigurationError(
      'El servidor no tiene configurado el secreto de sesión, así que no es posible iniciar sesión. Si administras esta instalación, define AUTH_SECRET.',
    );
  }

  const raw = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const session = await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ipHash: hashIp(meta.ip ?? null),
      expiresAt,
    },
  });

  const jwt = await new SignJWT({ sid: session.id, uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, `${jwt}.${raw}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return session.id;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (value) {
    const parsed = await parseCookie(value);
    if (parsed) {
      await db.session.updateMany({
        where: { id: parsed.sid, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }
  store.delete(COOKIE_NAME);
}

/** Revoca todas las sesiones del usuario salvo, opcionalmente, la actual. */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const res = await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
  return res.count;
}

async function parseCookie(value: string): Promise<{ sid: string; uid: string; raw: string } | null> {
  const idx = value.lastIndexOf('.');
  if (idx <= 0) return null;
  const jwt = value.slice(0, idx);
  const raw = value.slice(idx + 1);
  try {
    const { payload } = await jwtVerify(jwt, secret());
    if (typeof payload.sid !== 'string' || typeof payload.uid !== 'string') return null;
    return { sid: payload.sid, uid: payload.uid, raw };
  } catch {
    return null;
  }
}

export interface AuthContext {
  user: SessionUser;
  sessionId: string;
}

/**
 * Contexto de sesión. Devuelve `null` si no hay sesión válida.
 * Es la única puerta de entrada: ninguna ruta debe leer la cookie por su cuenta.
 */
export async function getAuth(): Promise<AuthContext | null> {
  // La cookie se lee SIEMPRE y lo primero, incluso en los casos en que ya se
  // sabe que la respuesta será `null`.
  //
  // No es una formalidad: llamar a `cookies()` es lo que marca la ruta como
  // dinámica en Next.js. Si se saliera antes —por ejemplo, al no haber
  // AUTH_SECRET, que durante la compilación nunca está— Next no vería ninguna
  // señal dinámica, prerenderizaría la página con el resultado "sin sesión" y
  // serviría esa copia con `s-maxage` de un año a todo el mundo, incluidos los
  // usuarios que sí han iniciado sesión. El síntoma es un bucle de
  // redirecciones entre /panel, /onboarding y /entrar.
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;

  // Sin secreto no puede existir ninguna sesión firmada válida, así que se
  // trata al visitante como anónimo en lugar de romper la página. Ver
  // `warnMissingSecret` para el razonamiento completo.
  if (!authSecretConfigured()) {
    warnMissingSecret();
    return null;
  }

  if (!value) return null;

  const parsed = await parseCookie(value);
  if (!parsed) return null;

  const session = await db.session.findUnique({
    where: { id: parsed.sid },
    include: {
      user: {
        include: { profile: true, subscription: true },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.tokenHash !== hashToken(parsed.raw)) return null;
  if (session.user.status !== 'ACTIVE' || session.user.deletedAt) return null;

  const sub = session.user.subscription;
  const activePlan: PlanId =
    sub && (sub.status === 'ACTIVE' || sub.status === 'TRIALING') && sub.currentPeriodEnd > new Date()
      ? (sub.planId as PlanId)
      : 'FREE';

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as Role,
      plan: activePlan,
      locale: session.user.locale as Locale,
      timezone: session.user.timezone,
      onboardingCompleted: session.user.onboardingCompleted,
      experienceLevel: (session.user.profile?.experienceLevel ?? 'PRINCIPIANTE') as ExperienceLevel,
    },
  };
}

/** Igual que `getAuth`, pero lanza si no hay sesión. Para rutas protegidas. */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new UnauthorizedError();
  return auth;
}

/**
 * Falta una variable de entorno imprescindible.
 *
 * Es distinto de un error interno: no hay ningún fallo en el código, sino en el
 * despliegue. Se devuelve 503 y un mensaje que dice qué configurar, en lugar de
 * un 500 opaco que obliga a bucear en los registros.
 */
export class ConfigurationError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = 'Necesitas iniciar sesión para continuar.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = 'No tienes permiso para realizar esta acción.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** Actualiza la marca de actividad y la racha diaria. */
export async function touchActivity(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { streakDays: true, streakUpdatedAt: true },
  });
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10);
  const last = user.streakUpdatedAt?.toISOString().slice(0, 10) ?? null;
  if (last === today) {
    await db.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
    return;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streakDays = last === yesterday ? user.streakDays + 1 : 1;

  await db.user.update({
    where: { id: userId },
    data: { lastSeenAt: new Date(), streakDays, streakUpdatedAt: new Date() },
  });
}
