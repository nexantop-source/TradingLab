import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createSession, touchActivity, verifyPassword } from '@/lib/auth';
import { clientIp, fail, handleError, ok } from '@/lib/api';
import { enforce, RATE_LIMITS } from '@/lib/rate-limit';
import { loginSchema } from '@/lib/validation';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const body = await req.json();
    const input = loginSchema.parse(body);

    // Límite doble: por IP y por cuenta, para dificultar tanto el barrido como
    // el ataque dirigido a un correo concreto.
    await enforce(`login:ip:${ip ?? 'anon'}`, RATE_LIMITS.login);
    await enforce(`login:email:${input.email}`, RATE_LIMITS.login);

    const user = await db.user.findUnique({ where: { email: input.email } });

    // Mensaje idéntico en ambos casos: no revelamos si el correo existe.
    const genericError = fail(
      'INVALID_CREDENTIALS',
      'El correo o la contraseña no son correctos.',
      401,
    );

    if (!user || user.deletedAt) return genericError;

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) return genericError;

    if (user.status === 'SUSPENDED') {
      return fail(
        'ACCOUNT_SUSPENDED',
        'Tu cuenta está suspendida. Escribe a soporte desde el centro de ayuda para revisar tu caso.',
        403,
      );
    }

    await createSession(user.id, { userAgent: req.headers.get('user-agent'), ip });
    await touchActivity(user.id);
    await track(ANALYTICS_EVENTS.LOGIN, {}, { userId: user.id });

    return ok({
      userId: user.id,
      next: user.onboardingCompleted ? '/panel' : '/onboarding',
    });
  } catch (error) {
    return handleError(error);
  }
}
