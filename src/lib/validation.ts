import { z } from 'zod';
import { EXPERIENCE_LEVELS, ASSET_CLASSES, LOCALES, THEMES, EMOTIONS } from '@tl/types';

/** Esquemas de entrada de la API. Toda ruta valida con uno de estos. */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Introduce una dirección de correo válida.')
  .max(254);

/**
 * Contraseña. Se exige longitud antes que complejidad artificial: una frase
 * larga es más segura y más fácil de recordar que ocho caracteres con símbolos.
 */
export const passwordSchema = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres.')
  .max(200, 'La contraseña no puede superar los 200 caracteres.')
  .refine((v) => !/^\d+$/.test(v), 'La contraseña no puede estar formada solo por números.')
  .refine(
    (v) => !['contrasena', 'password', '1234567890', 'tradinglab'].some((w) => v.toLowerCase().includes(w)),
    'Elige una contraseña menos previsible.',
  );

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Indica tu nombre.').max(80),
  email: emailSchema,
  password: passwordSchema,
  countryCode: z.string().length(2).toUpperCase(),
  timezone: z.string().min(1).max(60),
  locale: z.enum(LOCALES).default('es'),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar los términos y condiciones para crear la cuenta.' }),
  }),
  acceptRisk: z.literal(true, {
    errorMap: () => ({
      message: 'Debes confirmar que has leído la advertencia de riesgo y que entiendes que se trata de una plataforma educativa.',
    }),
  }),
  confirmAge: z.literal(true, {
    errorMap: () => ({ message: 'Debes confirmar que tienes la mayoría de edad en tu país de residencia.' }),
  }),
  marketingOptIn: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Introduce tu contraseña.'),
});

export const onboardingSchema = z.object({
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  marketInterests: z.array(z.enum(ASSET_CLASSES)).min(1, 'Selecciona al menos un mercado de interés.').max(6),
  educationalGoal: z.string().min(1).max(60),
  weeklyAvailability: z.number().int().min(1).max(40),
  assessmentAnswers: z.array(z.number().int().min(0).max(3)).min(6).max(12),
});

export const preferencesSchema = z.object({
  theme: z.enum(THEMES).optional(),
  reduceMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  locale: z.enum(LOCALES).optional(),
  timezone: z.string().min(1).max(60).optional(),
  emailOptIn: z.boolean().optional(),
  studyReminderOptIn: z.boolean().optional(),
  studyReminderHour: z.number().int().min(0).max(23).optional(),
});

export const journalEntrySchema = z.object({
  simulationId: z.string().min(1).nullable().default(null),
  title: z.string().trim().min(3, 'Ponle un título a la entrada.').max(140),
  hypothesis: z.string().trim().min(10, 'Describe tu hipótesis en al menos 10 caracteres.').max(2000),
  entryReason: z.string().trim().min(5).max(2000),
  emotionBefore: z.enum(EMOTIONS),
  emotionAfter: z.enum(EMOTIONS).nullable().default(null),
  riskLevel: z.number().int().min(1).max(5),
  indicatorsUsed: z.array(z.string().max(30)).max(12).default([]),
  result: z.string().max(60).nullable().default(null),
  mistake: z.string().max(1000).nullable().default(null),
  lesson: z.string().max(1000).nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
});

export const quizAttemptSchema = z.object({
  lessonSlug: z.string().min(1).max(120),
  answers: z.array(z.number().int().min(0).max(9)).min(1).max(30),
});

export const alertSchema = z.object({
  symbol: z.string().min(1).max(20),
  kind: z.enum(['PRICE', 'INDICATOR', 'EVENT']).default('PRICE'),
  condition: z.enum(['ABOVE', 'BELOW', 'CROSSES']),
  threshold: z.number().positive(),
  note: z.string().max(200).optional(),
});

export const watchlistSchema = z.object({
  symbol: z.string().min(1).max(20),
  action: z.enum(['ADD', 'REMOVE', 'TOGGLE_FAVORITE']),
});

export const aiAnalysisRequestSchema = z.object({
  kind: z.enum(['CHART_REVIEW', 'POST_TRADE', 'JOURNAL_REVIEW', 'NEWS_EXPLAINER', 'CONCEPT']),
  symbol: z.string().min(1).max(20).optional(),
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']).optional(),
  indicators: z.array(z.string().max(30)).max(12).default([]),
  simulationId: z.string().min(1).optional(),
  /** Pregunta libre del estudiante. Se sanea antes de llegar al modelo. */
  question: z.string().max(600).optional(),
  newsSlug: z.string().max(120).optional(),
});

export const adEventSchema = z.object({
  creativeId: z.string().min(1),
  campaignId: z.string().min(1),
  slotCode: z.string().min(1).max(60),
  type: z.enum(['IMPRESSION', 'CLICK', 'VIEWABLE']),
  page: z.string().max(120).default('/'),
});

export const subscribeSchema = z
  .object({
    planId: z.enum(['STANDARD', 'PREMIUM']),
    interval: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
    couponCode: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
    /** Token de idempotencia generado por el cliente; nunca decide monto ni plan. */
    idempotencyKey: z.string().trim().min(8).max(80).regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(4).max(140),
  body: z.string().trim().min(10).max(4000),
  category: z.enum(['GENERAL', 'CUENTA', 'FACTURACION', 'CONTENIDO', 'ERROR', 'FRAUDE']).default('GENERAL'),
});

export const strategySchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(1000),
  rules: z
    .array(z.object({ key: z.string().max(40), value: z.string().max(400) }))
    .max(12)
    .default([]),
});

/**
 * Concesión de una suscripción de cortesía desde el panel administrativo.
 * El motivo es obligatorio: una cortesía sin razón declarada no es auditable.
 */
export const subscriptionGrantSchema = z
  .object({
    email: emailSchema,
    plan: z.enum(['STANDARD', 'PREMIUM']),
    days: z.number().int().min(1).max(1095),
    reason: z.string().trim().min(4, 'Explica el motivo de la cortesía.').max(300),
  })
  .strict();

export const subscriptionRevokeSchema = z
  .object({
    userId: z.string().trim().min(1).max(60),
    reason: z.string().trim().min(4, 'Explica el motivo de la retirada.').max(300),
  })
  .strict();
