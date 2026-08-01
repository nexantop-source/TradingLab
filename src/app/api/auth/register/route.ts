import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createSession, hashIp, hashPassword } from '@/lib/auth';
import { clientIp, fail, handleError, ok } from '@/lib/api';
import { enforce, RATE_LIMITS } from '@/lib/rate-limit';
import { registerSchema } from '@/lib/validation';
import { ensureDemoAccount } from '@/lib/demo-account';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';
import { DEFAULT_WATCHLIST } from '@tl/market-data';
import { LEGAL_DOCS } from '@/content/legal';

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    await enforce(`register:${ip ?? 'anon'}`, RATE_LIMITS.register);

    const body = await req.json();
    const input = registerSchema.parse(body);

    // Países restringidos: se comprueba en el servidor, no en el formulario.
    const restricted = (process.env.RESTRICTED_COUNTRIES ?? '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (restricted.includes(input.countryCode)) {
      return fail(
        'COUNTRY_RESTRICTED',
        'Por el momento no ofrecemos el servicio en tu país de residencia.',
        403,
      );
    }

    const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) {
      // Mensaje deliberadamente idéntico al de un correo libre no sería útil
      // aquí: el usuario necesita saber que ya tiene cuenta para poder entrar.
      return fail('EMAIL_IN_USE', 'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.', 409);
    }

    const passwordHash = await hashPassword(input.password);

    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        countryCode: input.countryCode,
        timezone: input.timezone,
        locale: input.locale,
        role: 'STUDENT',
        profile: { create: { emailOptIn: input.marketingOptIn } },
        watchlists: {
          create: DEFAULT_WATCHLIST.map((symbol, i) => ({ symbol, position: i, favorite: i < 2 })),
        },
      },
    });

    // Cuenta DEMO con su asiento de apertura: criterio de aceptación #1.
    const account = await ensureDemoAccount(user.id);
    await db.portfolio.create({
      data: { userId: user.id, demoAccountId: account.id, name: 'Portafolio principal', benchmark: 'SPX500' },
    });

    // Registro de consentimientos con la versión concreta del documento.
    const ipHash = hashIp(ip);
    const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null;
    const consents: Array<{ slug: string; kind: string; granted: boolean }> = [
      { slug: 'terminos', kind: 'TERMS', granted: true },
      { slug: 'privacidad', kind: 'PRIVACY', granted: true },
      { slug: 'riesgo', kind: 'RISK', granted: true },
      { slug: 'terminos', kind: 'MARKETING', granted: input.marketingOptIn },
    ];
    for (const c of consents) {
      const meta = LEGAL_DOCS.find((d) => d.slug === c.slug);
      if (!meta) continue;
      const doc = await db.legalDocument.findUnique({
        where: { slug_version: { slug: meta.slug, version: meta.version } },
      });
      if (!doc) continue;
      await db.consent.create({
        data: { userId: user.id, documentId: doc.id, kind: c.kind, granted: c.granted, ipHash, userAgent },
      });
    }

    await createSession(user.id, { userAgent, ip });
    await track(
      ANALYTICS_EVENTS.SIGNUP_COMPLETED,
      { countryCode: input.countryCode, locale: input.locale },
      { userId: user.id },
    );
    await track(ANALYTICS_EVENTS.DEMO_ACCOUNT_CREATED, { balanceCents: account.balanceCents }, { userId: user.id });

    return ok({
      userId: user.id,
      demoBalanceCents: account.balanceCents,
      next: '/onboarding',
    });
  } catch (error) {
    return handleError(error);
  }
}
