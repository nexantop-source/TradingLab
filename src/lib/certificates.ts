import 'server-only';
import { randomBytes } from 'node:crypto';
import { db } from './db';
import { entitlements } from '@tl/types/plans';
import type { PlanId } from '@tl/types';

/**
 * Certificados de ruta formativa.
 *
 * Se emiten al completar **todas** las lecciones publicadas de una ruta. No se
 * regalan por tiempo de uso ni por abrir contenido: la lección solo se da por
 * completada tras superar su cuestionario y, cuando corresponde, tras haber
 * hecho el ejercicio práctico. Un certificado que no cuesta nada no acredita
 * nada, y aquí lo que se acredita es criterio.
 *
 * `verified` distingue el certificado con verificación pública (Pro) del
 * simple comprobante de finalización (Plus). La diferencia es real: solo el
 * verificado aparece en la página pública de comprobación.
 */

/** Código público de comprobación. Sin datos personales y no adivinable. */
export function issueVerificationCode(): string {
  // Base32 sin vocales ni caracteres ambiguos: se puede dictar por teléfono.
  const alphabet = '0123456789BCDFGHJKLMNPQRSTVWXYZ';
  const bytes = randomBytes(12);
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += alphabet[bytes[i] % alphabet.length];
    if (i === 3 || i === 7) code += '-';
  }
  return code;
}

export interface IssuedCertificate {
  trackSlug: string;
  trackTitle: string;
  verificationCode: string;
  verified: boolean;
  issuedAt: Date;
}

/**
 * Emite los certificados de las rutas que la cuenta acaba de terminar.
 *
 * Es idempotente: una ruta ya certificada no vuelve a emitirse, así que puede
 * invocarse en cada lección completada sin acumular duplicados.
 */
export async function issueEarnedCertificates(userId: string, plan: PlanId): Promise<IssuedCertificate[]> {
  const level = entitlements(plan).features.certificates;
  if (level === 'none') return [];

  const [tracks, completed, existing] = await Promise.all([
    db.track.findMany({
      where: { published: true },
      select: {
        slug: true,
        title: true,
        courses: {
          where: { published: true },
          select: { modules: { select: { lessons: { where: { published: true }, select: { id: true } } } } },
        },
      },
    }),
    db.userProgress.findMany({ where: { userId, status: 'COMPLETED' }, select: { lessonId: true } }),
    db.certificate.findMany({ where: { userId }, select: { trackSlug: true } }),
  ]);

  const done = new Set(completed.map((entry) => entry.lessonId));
  const certified = new Set(existing.map((entry) => entry.trackSlug));
  const issued: IssuedCertificate[] = [];

  for (const track of tracks) {
    if (certified.has(track.slug)) continue;
    const lessons = track.courses.flatMap((course) => course.modules.flatMap((module) => module.lessons));
    // Una ruta sin lecciones publicadas no se ha completado: no se certifica.
    if (lessons.length === 0) continue;
    if (!lessons.every((lesson) => done.has(lesson.id))) continue;

    try {
      const certificate = await db.certificate.create({
        data: {
          userId,
          trackSlug: track.slug,
          trackTitle: track.title,
          verificationCode: issueVerificationCode(),
          verified: level === 'verified',
        },
      });
      issued.push({
        trackSlug: certificate.trackSlug,
        trackTitle: certificate.trackTitle,
        verificationCode: certificate.verificationCode,
        verified: certificate.verified,
        issuedAt: certificate.issuedAt,
      });
    } catch {
      // Dos lecciones completadas a la vez pueden intentar emitir el mismo
      // certificado: el índice único gana y aquí simplemente se ignora.
    }
  }

  return issued;
}

/**
 * Comprueba un código públicamente.
 *
 * Devuelve lo justo para que un tercero confirme que el certificado es
 * auténtico: qué ruta, cuándo y a nombre de quién. Nunca el correo, el
 * identificador de la cuenta ni su plan. Solo los certificados verificados son
 * comprobables: un comprobante de finalización no es una credencial pública.
 */
export async function verifyCertificate(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[0-9BCDFGHJKLMNPQRSTVWXYZ-]{10,20}$/.test(normalized)) return null;

  const certificate = await db.certificate.findUnique({
    where: { verificationCode: normalized },
    select: {
      trackTitle: true,
      issuedAt: true,
      verified: true,
      user: { select: { name: true } },
    },
  });

  if (!certificate || !certificate.verified) return null;

  return {
    holderName: certificate.user.name,
    trackTitle: certificate.trackTitle,
    issuedAt: certificate.issuedAt,
  };
}
