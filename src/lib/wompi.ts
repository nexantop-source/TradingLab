import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db } from './db';
import type { PlanId } from '@tl/types';

export type WompiEnvironment = 'sandbox' | 'production';
export type WompiInterval = 'MONTHLY' | 'YEARLY';
export type WompiPlanId = Exclude<PlanId, 'FREE'>;
export type WompiTransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';
type WompiEnv = Readonly<Record<string, string | undefined>>;

const CHECKOUT_URL = 'https://checkout.wompi.co/p/';
const CHECKOUT_TTL_MS = 30 * 60 * 1000;
const MAX_API_RESPONSE_BYTES = 256 * 1024;
const PAYMENT_PREFIX = 'wompi:';
const PAYMENT_METADATA_RE = /\[tl:wompi:v1:(STANDARD|PREMIUM):(MONTHLY|YEARLY)\]$/;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;
const REFERENCE_RE = /^[A-Za-z0-9_-]{8,80}$/;
const TRANSACTION_ID_RE = /^[A-Za-z0-9_-]{6,255}$/;
const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

const PRICE_ENV_KEYS = {
  STANDARD: {
    MONTHLY: 'WOMPI_STANDARD_MONTHLY_AMOUNT_IN_CENTS',
    YEARLY: 'WOMPI_STANDARD_YEARLY_AMOUNT_IN_CENTS',
  },
  PREMIUM: {
    MONTHLY: 'WOMPI_PREMIUM_MONTHLY_AMOUNT_IN_CENTS',
    YEARLY: 'WOMPI_PREMIUM_YEARLY_AMOUNT_IN_CENTS',
  },
} as const;

export class WompiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'WompiError';
  }
}

export interface WompiConfig {
  environment: WompiEnvironment;
  eventEnvironment: 'test' | 'prod';
  apiBaseUrl: 'https://sandbox.wompi.co/v1' | 'https://production.wompi.co/v1';
  publicKey: string;
  privateKey: string | null;
  integritySecret: string;
  eventsSecret: string;
}

interface ReadConfigOptions {
  requireIntegrity?: boolean;
  requireEvents?: boolean;
}

/**
 * Lee y valida las credenciales sin registrarlas ni enviarlas al cliente.
 * Cada ambiente de Wompi tiene llaves distintas; mezclar test y producción se
 * considera un error de configuración y bloquea el checkout/webhook.
 */
export function readWompiConfig(
  env: WompiEnv = process.env,
  options: ReadConfigOptions = {},
): WompiConfig {
  const environment = env.WOMPI_ENVIRONMENT;
  if (environment !== 'sandbox' && environment !== 'production') {
    throw new WompiError(
      'WOMPI_NOT_CONFIGURED',
      'Wompi requiere WOMPI_ENVIRONMENT=sandbox o production.',
      503,
    );
  }

  const publicKey = requiredSecret(env.WOMPI_PUBLIC_KEY, 'WOMPI_PUBLIC_KEY');
  const privateKey = optionalSecret(env.WOMPI_PRIVATE_KEY);
  const integritySecret = options.requireIntegrity
    ? requiredSecret(env.WOMPI_INTEGRITY_SECRET, 'WOMPI_INTEGRITY_SECRET')
    : optionalSecret(env.WOMPI_INTEGRITY_SECRET) ?? '';
  const eventsSecret = options.requireEvents
    ? requiredSecret(env.WOMPI_EVENTS_SECRET, 'WOMPI_EVENTS_SECRET')
    : optionalSecret(env.WOMPI_EVENTS_SECRET) ?? '';

  validateKeyEnvironment(environment, 'public', publicKey);
  if (privateKey) validateKeyEnvironment(environment, 'private', privateKey);
  if (integritySecret) validateKeyEnvironment(environment, 'integrity', integritySecret);
  if (eventsSecret) validateKeyEnvironment(environment, 'events', eventsSecret);

  return {
    environment,
    eventEnvironment: environment === 'sandbox' ? 'test' : 'prod',
    apiBaseUrl:
      environment === 'sandbox'
        ? 'https://sandbox.wompi.co/v1'
        : 'https://production.wompi.co/v1',
    publicKey,
    privateKey,
    integritySecret,
    eventsSecret,
  };
}

function requiredSecret(value: string | undefined, name: string): string {
  const normalized = optionalSecret(value);
  if (!normalized) {
    throw new WompiError('WOMPI_NOT_CONFIGURED', `Falta configurar ${name}.`, 503);
  }
  return normalized;
}

function optionalSecret(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validateKeyEnvironment(
  environment: WompiEnvironment,
  kind: 'public' | 'private' | 'integrity' | 'events',
  value: string,
): void {
  const testPrefixes: Record<typeof kind, string> = {
    public: 'pub_test_',
    private: 'prv_test_',
    integrity: 'test_integrity_',
    events: 'test_events_',
  };
  const productionPrefixes: Record<typeof kind, string> = {
    public: 'pub_prod_',
    private: 'prv_prod_',
    integrity: 'prod_integrity_',
    events: 'prod_events_',
  };

  const valid =
    environment === 'sandbox'
      ? value.startsWith(testPrefixes[kind])
      : value.startsWith(productionPrefixes[kind]) && !value.startsWith(testPrefixes[kind]);

  if (!valid) {
    throw new WompiError(
      'WOMPI_ENVIRONMENT_MISMATCH',
      `La credencial Wompi ${kind} no pertenece al ambiente ${environment}.`,
      503,
    );
  }
}

/** Importe comercial fijo, en centavos de COP. Nunca se recibe del cliente. */
export function wompiAmountInCents(
  planId: WompiPlanId,
  interval: WompiInterval,
  env: WompiEnv = process.env,
): number {
  const key = PRICE_ENV_KEYS[planId][interval];
  const raw = env[key]?.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    throw new WompiError(
      'WOMPI_PRICE_NOT_CONFIGURED',
      `Falta configurar un importe entero válido en ${key}.`,
      503,
    );
  }

  const amount = Number(raw);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2_147_483_647) {
    throw new WompiError(
      'WOMPI_PRICE_NOT_CONFIGURED',
      `${key} debe ser un entero positivo en centavos de COP.`,
      503,
    );
  }
  return amount;
}

export function wompiIntegritySignature(
  reference: string,
  amountInCents: number,
  integritySecret: string,
  expirationTime?: string,
): string {
  if (!REFERENCE_RE.test(reference) || !Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    throw new WompiError('INVALID_CHECKOUT', 'No se pudo generar una referencia de pago válida.', 500);
  }
  if (expirationTime) {
    const expiration = new Date(expirationTime);
    if (!Number.isFinite(expiration.getTime()) || expiration.toISOString() !== expirationTime) {
      throw new WompiError('INVALID_CHECKOUT', 'La expiración del checkout no es válida.', 500);
    }
  }
  return createHash('sha256')
    // Wompi exige que expiration-time esté dentro de la firma, antes del
    // secreto de integridad, cuando se utiliza ese parámetro.
    .update(`${reference}${amountInCents}COP${expirationTime ?? ''}${integritySecret}`, 'utf8')
    .digest('hex');
}

/**
 * Referencia opaca y determinística por usuario + clave idempotente. Un reintento
 * del mismo checkout obtiene la misma referencia, sin filtrar el id del usuario.
 */
export function wompiReference(
  userId: string,
  clientIdempotencyKey: string,
  integritySecret: string,
): string {
  const digest = createHmac('sha256', integritySecret)
    .update(`tradinglab-wompi-v1\0${userId}\0${clientIdempotencyKey}`, 'utf8')
    .digest('hex');
  return `tl_${digest.slice(0, 48)}`;
}

export function buildWompiCheckoutUrl(params: {
  publicKey: string;
  integritySecret: string;
  reference: string;
  amountInCents: number;
  redirectUrl: string;
  expirationTime?: string;
}): string {
  const redirect = parseHttpsUrl(params.redirectUrl, 'WOMPI_REDIRECT_URL');
  const url = new URL(CHECKOUT_URL);
  url.searchParams.set('public-key', params.publicKey);
  url.searchParams.set('currency', 'COP');
  url.searchParams.set('amount-in-cents', String(params.amountInCents));
  url.searchParams.set('reference', params.reference);
  url.searchParams.set(
    'signature:integrity',
    wompiIntegritySignature(
      params.reference,
      params.amountInCents,
      params.integritySecret,
      params.expirationTime,
    ),
  );
  url.searchParams.set('redirect-url', redirect.toString());
  if (params.expirationTime) url.searchParams.set('expiration-time', params.expirationTime);
  return url.toString();
}

function parseHttpsUrl(value: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WompiError('WOMPI_NOT_CONFIGURED', `${name} no es una URL válida.`, 503);
  }
  if (url.protocol !== 'https:') {
    throw new WompiError('WOMPI_NOT_CONFIGURED', `${name} debe usar HTTPS.`, 503);
  }
  return url;
}

export function wompiPaymentDescription(planId: WompiPlanId, interval: WompiInterval): string {
  const plan = planId === 'STANDARD' ? 'Standard' : 'Premium';
  const cadence = interval === 'YEARLY' ? 'anual' : 'mensual';
  return `Suscripción ${plan} (${cadence}) [tl:wompi:v1:${planId}:${interval}]`;
}

export function wompiPaymentIdempotencyKey(reference: string): string {
  if (!REFERENCE_RE.test(reference)) {
    throw new WompiError('INVALID_REFERENCE', 'La referencia de pago no es válida.', 400);
  }
  return `${PAYMENT_PREFIX}${reference}`;
}

export function parseWompiPaymentDescription(description: string): {
  planId: WompiPlanId;
  interval: WompiInterval;
} {
  const match = PAYMENT_METADATA_RE.exec(description);
  if (!match) {
    throw new WompiError(
      'PAYMENT_METADATA_INVALID',
      'El pago no contiene metadatos internos válidos.',
      409,
    );
  }
  return {
    planId: match[1] as WompiPlanId,
    interval: match[2] as WompiInterval,
  };
}

export class WompiBillingProvider {
  readonly id = 'wompi';

  async createCheckout(params: {
    userId: string;
    email: string;
    planId: WompiPlanId;
    interval: WompiInterval;
    couponCode?: string;
    idempotencyKey: string;
  }) {
    // Coupon.amountOffCents no tiene moneda en el esquema actual. Aplicarlo a
    // COP sería ambiguo y peligroso; se bloquea hasta migrar cupones por moneda.
    if (params.couponCode?.trim()) {
      throw new WompiError(
        'WOMPI_COUPON_UNSUPPORTED',
        'Los cupones todavía no están habilitados para pagos en COP.',
        422,
      );
    }

    // Do not issue a payable link if the server cannot validate its webhook.
    const config = readWompiConfig(process.env, { requireIntegrity: true, requireEvents: true });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!appUrl) {
      throw new WompiError('WOMPI_NOT_CONFIGURED', 'Falta configurar NEXT_PUBLIC_APP_URL para el retorno seguro de Wompi.', 503);
    }
    const origin = parseHttpsUrl(appUrl, 'NEXT_PUBLIC_APP_URL');
    const reference = wompiReference(params.userId, params.idempotencyKey, config.integritySecret);
    const idempotencyKey = wompiPaymentIdempotencyKey(reference);
    const description = wompiPaymentDescription(params.planId, params.interval);
    const now = new Date();

    // El update de User funciona como cerrojo por cuenta. Dos pestañas con
    // claves distintas no pueden superar a la vez la comprobación de PENDING.
    // SERIALIZABLE añade una segunda barrera en PostgreSQL y SQLite.
    const payment = await db.$transaction(
      async (tx) => {
        const locked = await tx.user.updateMany({
          where: { id: params.userId },
          data: { updatedAt: now },
        });
        if (locked.count !== 1) {
          throw new WompiError('USER_NOT_FOUND', 'No se encontró la cuenta del checkout.', 404);
        }

        const existing = await tx.payment.findUnique({ where: { idempotencyKey } });
        if (existing) {
          // El importe es un snapshot inmutable: un cambio de tarifa posterior
          // no debe romper un reintento con la misma clave.
          if (
            existing.userId !== params.userId ||
            existing.currency !== 'COP' ||
            existing.description !== description
          ) {
            throw new WompiError(
              'IDEMPOTENCY_CONFLICT',
              'La clave idempotente ya fue utilizada con otra compra.',
              409,
            );
          }
        }

        const activeSubscription = await tx.subscription.findUnique({ where: { userId: params.userId } });
        if (
          existing?.status !== 'SUCCEEDED' &&
          activeSubscription &&
          ['ACTIVE', 'TRIALING'].includes(activeSubscription.status) &&
          activeSubscription.currentPeriodEnd > now
        ) {
          throw new WompiError(
            'SUBSCRIPTION_ALREADY_ACTIVE',
            'Ya tienes un periodo activo. No se abrió otro checkout para evitar un doble cobro.',
            409,
          );
        }

        if (existing) return existing;

        const otherPendingPayments = await tx.payment.findMany({
          where: {
            userId: params.userId,
            currency: 'COP',
            status: 'PENDING',
            idempotencyKey: { not: idempotencyKey },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (otherPendingPayments.length > 0) {
          const stillLive = otherPendingPayments.some((candidate) => {
            const expiresAt = new Date(candidate.createdAt.getTime() + CHECKOUT_TTL_MS);
            return Boolean(candidate.externalId) || expiresAt > now;
          });
          // Si Wompi ya asignó un transaction id, el medio de pago puede seguir
          // procesándose incluso después de cerrar el Checkout. Se bloquea otro
          // cobro hasta recibir un estado terminal o resolverlo por soporte.
          if (stillLive) {
            throw new WompiError(
              'PAYMENT_ALREADY_PENDING',
              'Ya existe un pago pendiente para esta cuenta. Reanúdalo o espera su resultado antes de crear otro.',
              409,
            );
          }

          // La URL anterior ya expiró en Wompi y nunca produjo transaction id.
          // Se marca como reemplazada; una aprobación tardía quedará en revisión
          // y jamás activará acceso automáticamente.
          const superseded = await tx.payment.updateMany({
            where: {
              id: { in: otherPendingPayments.map((candidate) => candidate.id) },
              status: 'PENDING',
              externalId: null,
            },
            data: { status: 'SUPERSEDED', processedAt: now },
          });
          if (superseded.count !== otherPendingPayments.length) {
            throw new WompiError(
              'PAYMENT_ALREADY_PENDING',
              'El pago anterior está cambiando de estado. Espera su resultado antes de crear otro.',
              409,
            );
          }
        }

        const amountInCents = wompiAmountInCents(params.planId, params.interval);
        return tx.payment.create({
          data: {
            userId: params.userId,
            amountCents: amountInCents,
            currency: 'COP',
            status: 'PENDING',
            description,
            idempotencyKey,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    const amountInCents = payment.amountCents;

    const subscription = await db.subscription.findUnique({ where: { userId: params.userId } });
    if (payment.status === 'SUCCEEDED' && subscription?.externalId === payment.externalId) {
      return {
        status: 'ACTIVE' as const,
        provider: 'wompi' as const,
        paymentId: payment.id,
        reference,
        environment: config.environment,
        subscriptionId: subscription.id,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      };
    }
    if (payment.status !== 'PENDING') {
      throw new WompiError(
        'PAYMENT_REFERENCE_USED',
        'Este intento de pago ya terminó. Inicia un checkout nuevo.',
        409,
      );
    }

    const expirationTime = new Date(payment.createdAt.getTime() + CHECKOUT_TTL_MS).toISOString();
    if (Date.parse(expirationTime) <= Date.now()) {
      if (payment.externalId) {
        throw new WompiError(
          'PAYMENT_STILL_PROCESSING',
          'Wompi ya recibió este pago y todavía lo procesa. No abras otro checkout.',
          409,
        );
      }
      const superseded = await db.payment.updateMany({
        where: { id: payment.id, status: 'PENDING', externalId: null },
        data: { status: 'SUPERSEDED', processedAt: new Date() },
      });
      throw new WompiError(
        superseded.count === 1 ? 'PAYMENT_CHECKOUT_EXPIRED' : 'PAYMENT_STILL_PROCESSING',
        superseded.count === 1
          ? 'Este checkout expiró sin iniciar una transacción. Crea un intento nuevo.'
          : 'El pago cambió de estado y todavía se procesa. No abras otro checkout.',
        409,
      );
    }

    const redirectUrl = new URL('/perfil?checkout=wompi', origin);
    const checkoutUrl = buildWompiCheckoutUrl({
      publicKey: config.publicKey,
      integritySecret: config.integritySecret,
      reference,
      amountInCents,
      redirectUrl: redirectUrl.toString(),
      expirationTime,
    });

    return {
      status: 'REDIRECT' as const,
      provider: 'wompi' as const,
      paymentId: payment.id,
      reference,
      expiresAt: expirationTime,
      environment: config.environment,
      redirectUrl: checkoutUrl,
      amountInCents,
      currency: 'COP' as const,
      // Se conserva el contrato histórico. Mientras el pago está pendiente,
      // este identificador correlaciona el intento; no representa acceso activo.
      subscriptionId: subscription?.id ?? payment.id,
      currentPeriodEnd: subscription?.currentPeriodEnd.toISOString() ?? new Date().toISOString(),
    };
  }

  async cancel(params: { userId: string; atPeriodEnd: boolean }) {
    const sub = await db.subscription.findUnique({ where: { userId: params.userId } });
    if (!sub) throw new WompiError('SUBSCRIPTION_NOT_FOUND', 'No hay una suscripción que cancelar.', 404);

    const canceledAt = new Date();
    await db.subscription.update({
      where: { userId: params.userId },
      data: {
        cancelAtPeriodEnd: params.atPeriodEnd,
        canceledAt,
        status: params.atPeriodEnd ? sub.status : 'CANCELED',
        ...(params.atPeriodEnd ? {} : { currentPeriodEnd: canceledAt }),
      },
    });

    return {
      canceledAt: canceledAt.toISOString(),
      accessUntil: (params.atPeriodEnd ? sub.currentPeriodEnd : canceledAt).toISOString(),
    };
  }

  async resume(params: { userId: string }) {
    const sub = await db.subscription.findUnique({ where: { userId: params.userId } });
    if (!sub || sub.currentPeriodEnd <= new Date()) {
      throw new WompiError(
        'SUBSCRIPTION_EXPIRED',
        'El periodo pagado terminó; inicia un checkout nuevo.',
        409,
      );
    }
    await db.subscription.update({
      where: { userId: params.userId },
      data: { cancelAtPeriodEnd: false, canceledAt: null, status: 'ACTIVE' },
    });
    return { resumed: true };
  }
}

const baseWebhookEventSchema = z
  .object({
    event: z.string().min(1).max(80),
    data: z.record(z.unknown()),
    environment: z.enum(['test', 'prod']),
    signature: z
      .object({
        properties: z
          .array(
            z
              .string()
              .min(1)
              .max(200)
              .regex(/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/),
          )
          .min(1)
          .max(32),
        checksum: z.string().regex(SHA256_HEX_RE),
      })
      .strict(),
    timestamp: z.number().int().safe().nonnegative(),
    sent_at: z.string().datetime({ offset: true }),
  })
  .strict();

const webhookTransactionSchema = z
  .object({
    id: z.string().regex(TRANSACTION_ID_RE),
    amount_in_cents: z.number().int().positive().max(2_147_483_647),
    reference: z.string().regex(REFERENCE_RE),
    currency: z.literal('COP'),
    status: z.enum(['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR']),
  })
  .passthrough();

export type WompiWebhookEvent = z.infer<typeof baseWebhookEventSchema>;

export function parseWompiWebhookEvent(raw: string): WompiWebhookEvent {
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new WompiError('INVALID_PAYLOAD', 'El webhook no contiene JSON válido.', 400);
  }

  const parsed = baseWebhookEventSchema.safeParse(input);
  if (!parsed.success) {
    throw new WompiError('INVALID_PAYLOAD', 'La estructura del webhook no es válida.', 400);
  }
  return parsed.data;
}

export function webhookTransaction(event: WompiWebhookEvent): z.infer<typeof webhookTransactionSchema> {
  if (event.event !== 'transaction.updated') {
    throw new WompiError('UNSUPPORTED_EVENT', 'El evento no es transaction.updated.', 400);
  }
  const data = event.data as Record<string, unknown>;
  const parsed = webhookTransactionSchema.safeParse(data.transaction);
  if (!parsed.success) {
    throw new WompiError('INVALID_PAYLOAD', 'La transacción del webhook no es válida.', 400);
  }
  return parsed.data;
}

/** Verifica las propiedades dinámicas exactamente en el orden enviado por Wompi. */
export function verifyWompiEventSignature(
  event: WompiWebhookEvent,
  eventsSecret: string,
  headerChecksum: string | null,
): boolean {
  // El ID es el único dato del webhook que usamos para consultar la fuente
  // autoritativa. Debe estar cubierto por la firma; de otro modo un cuerpo
  // capturado podría apuntarnos a otra transacción. También se rechazan rutas
  // repetidas para que la representación firmada sea canónica.
  const signedProperties = event.signature.properties;
  if (
    new Set(signedProperties).size !== signedProperties.length ||
    (event.event === 'transaction.updated' && !signedProperties.includes('transaction.id'))
  ) {
    return false;
  }

  const bodyChecksum = event.signature.checksum.toLowerCase();
  if (headerChecksum) {
    const normalizedHeader = headerChecksum.trim().toLowerCase();
    if (!SHA256_HEX_RE.test(normalizedHeader) || !constantTimeHexEqual(normalizedHeader, bodyChecksum)) {
      return false;
    }
  }

  let signedValues = '';
  try {
    for (const path of signedProperties) {
      signedValues += signedScalarAtPath(event.data, path);
    }
  } catch {
    return false;
  }

  const expected = createHash('sha256')
    .update(`${signedValues}${event.timestamp}${eventsSecret}`, 'utf8')
    .digest('hex');
  return constantTimeHexEqual(expected, bodyChecksum);
}

function signedScalarAtPath(data: Record<string, unknown>, path: string): string {
  const segments = path.split('.');
  let cursor: unknown = data;

  for (const segment of segments) {
    if (FORBIDDEN_PATH_SEGMENTS.has(segment)) {
      throw new WompiError('INVALID_SIGNATURE_PATH', 'Ruta de firma no permitida.', 400);
    }
    if (typeof cursor !== 'object' || cursor === null || !Object.prototype.hasOwnProperty.call(cursor, segment)) {
      throw new WompiError('INVALID_SIGNATURE_PATH', 'Ruta de firma inexistente.', 400);
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }

  if (
    cursor !== null &&
    typeof cursor !== 'string' &&
    typeof cursor !== 'number' &&
    typeof cursor !== 'boolean'
  ) {
    throw new WompiError('INVALID_SIGNATURE_PATH', 'La firma solo admite valores escalares.', 400);
  }
  return String(cursor);
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (!SHA256_HEX_RE.test(a) || !SHA256_HEX_RE.test(b)) return false;
  const left = Buffer.from(a.toLowerCase(), 'hex');
  const right = Buffer.from(b.toLowerCase(), 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function wompiEventFingerprint(event: WompiWebhookEvent): string {
  const transaction = webhookTransaction(event);
  return createHash('sha256')
    .update(
      [
        event.event,
        transaction.id,
        transaction.status,
        String(event.timestamp),
        event.signature.checksum.toLowerCase(),
      ].join('|'),
      'utf8',
    )
    .digest('hex');
}

const authoritativeTransactionSchema = z
  .object({
    id: z.string().regex(TRANSACTION_ID_RE),
    amount_in_cents: z.number().int().positive().max(2_147_483_647),
    reference: z.string().regex(REFERENCE_RE),
    currency: z.literal('COP'),
    status: z.enum(['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR']),
  })
  .passthrough();

export type WompiTransaction = z.infer<typeof authoritativeTransactionSchema>;

export async function fetchWompiTransaction(
  transactionId: string,
  config: WompiConfig = readWompiConfig(),
): Promise<WompiTransaction> {
  if (!TRANSACTION_ID_RE.test(transactionId)) {
    throw new WompiError('INVALID_TRANSACTION_ID', 'Identificador de transacción no válido.', 400);
  }

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/transactions/${encodeURIComponent(transactionId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.publicKey}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new WompiError(
      'WOMPI_UNAVAILABLE',
      'No fue posible verificar la transacción con Wompi.',
      502,
    );
  }

  if (!response.ok) {
    throw new WompiError(
      'WOMPI_UNAVAILABLE',
      'Wompi no confirmó la transacción solicitada.',
      response.status === 404 ? 404 : 502,
    );
  }

  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_API_RESPONSE_BYTES) {
    throw new WompiError('WOMPI_INVALID_RESPONSE', 'Wompi respondió con datos no válidos.', 502);
  }

  let responseText: string;
  try {
    responseText = await response.text();
  } catch {
    throw new WompiError('WOMPI_INVALID_RESPONSE', 'Wompi respondió con datos no válidos.', 502);
  }
  if (Buffer.byteLength(responseText, 'utf8') > MAX_API_RESPONSE_BYTES) {
    throw new WompiError('WOMPI_INVALID_RESPONSE', 'Wompi respondió con datos no válidos.', 502);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new WompiError('WOMPI_INVALID_RESPONSE', 'Wompi respondió con datos no válidos.', 502);
  }
  const parsed = z.object({ data: authoritativeTransactionSchema }).passthrough().safeParse(payload);
  if (!parsed.success || parsed.data.data.id !== transactionId) {
    throw new WompiError('WOMPI_INVALID_RESPONSE', 'Wompi respondió con datos no válidos.', 502);
  }
  return parsed.data.data;
}

export interface WompiReconcileResult {
  transactionStatus: WompiTransactionStatus;
  paymentStatus: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'SUPERSEDED' | 'REVIEW_REQUIRED';
  changed: boolean;
  membership: 'UNCHANGED' | 'ACTIVE' | 'CANCELED';
}

/**
 * Aplica únicamente el estado obtenido mediante GET a Wompi. La referencia
 * resuelve el Payment y, desde él, al usuario: ningún userId/plan/periodo del
 * webhook tiene autoridad.
 */
export async function reconcileWompiTransaction(
  transaction: WompiTransaction,
): Promise<WompiReconcileResult> {
  const payment = await db.payment.findUnique({
    where: { idempotencyKey: wompiPaymentIdempotencyKey(transaction.reference) },
  });
  if (!payment) {
    throw new WompiError('PAYMENT_NOT_FOUND', 'La referencia no pertenece a un pago pendiente.', 404);
  }

  const metadata = parseWompiPaymentDescription(payment.description);
  // Payment.amountCents es el snapshot firmado al abrir el checkout. Nunca se
  // recalcula desde tarifas ambientales al procesar un evento posterior.
  const expectedAmount = payment.amountCents;
  if (
    payment.currency !== 'COP' ||
    transaction.currency !== 'COP' ||
    transaction.amount_in_cents !== expectedAmount
  ) {
    throw new WompiError(
      'PAYMENT_MISMATCH',
      'La transacción no coincide con la compra registrada.',
      409,
    );
  }

  return db.$transaction(async (tx) => {
    // Serializa todas las transiciones de pago pertenecientes a una cuenta.
    // Esto evita que dos referencias APPROVED vean simultáneamente la misma
    // membresía vencida y ambas intenten reclamarla.
    const locked = await tx.user.updateMany({
      where: { id: payment.userId },
      data: { updatedAt: new Date() },
    });
    if (locked.count !== 1) {
      throw new WompiError('USER_NOT_FOUND', 'La cuenta asociada al pago ya no existe.', 404);
    }

    const current = await tx.payment.findUnique({ where: { id: payment.id } });
    if (!current) {
      throw new WompiError('PAYMENT_NOT_FOUND', 'El pago ya no existe.', 404);
    }
    const sameTransaction = current.externalId === transaction.id;

    if (transaction.status === 'PENDING') {
      if (current.status !== 'PENDING') {
        return {
          transactionStatus: transaction.status,
          paymentStatus: current.status as WompiReconcileResult['paymentStatus'],
          changed: false,
          membership: 'UNCHANGED' as const,
        };
      }
      const updated = await tx.payment.update({
        where: { id: current.id },
        data: { externalId: transaction.id },
      });
      return {
        transactionStatus: transaction.status,
        paymentStatus: updated.status as WompiReconcileResult['paymentStatus'],
        changed: !current.externalId,
        membership: 'UNCHANGED' as const,
      };
    }

    if (transaction.status === 'APPROVED') {
      if (current.status === 'SUCCEEDED' || current.status === 'REFUNDED') {
        // Wompi puede producir varios IDs al reintentar una misma referencia.
        // El ID que ya quedó aprobado/anulado es canónico. Otro APPROVED puede
        // representar un segundo cobro: se alerta sin reemplazar externalId ni
        // tocar el periodo asociado al primer ID.
        if (!sameTransaction) {
          await tx.payment.update({
            where: { id: current.id },
            data: { status: 'REVIEW_REQUIRED' },
          });
          await tx.notification.create({
            data: {
              userId: current.userId,
              kind: 'WARNING',
              title: 'Posible cobro duplicado en revisión',
              body: 'Wompi aprobó otro identificador para la misma referencia. Conservamos tu membresía sin cambios y soporte revisará el cargo.',
              href: '/soporte',
            },
          });
          await tx.supportTicket.create({
            data: {
              userId: current.userId,
              subject: 'Revisar posible cobro Wompi duplicado',
              body: `Pago interno ${current.id}. ID canónico: ${current.externalId ?? 'sin ID'}. Segundo ID aprobado: ${transaction.id}. Verificar en Wompi y resolver el cargo sin modificar automáticamente la membresía.`,
              category: 'PAGOS',
              status: 'OPEN',
              priority: 'HIGH',
            },
          });
          return {
            transactionStatus: transaction.status,
            paymentStatus: 'REVIEW_REQUIRED' as const,
            changed: true,
            membership: 'UNCHANGED' as const,
          };
        }
        return {
          transactionStatus: transaction.status,
          paymentStatus: current.status as WompiReconcileResult['paymentStatus'],
          changed: false,
          membership: 'UNCHANGED' as const,
        };
      }

      if (current.status === 'REVIEW_REQUIRED') {
        return {
          transactionStatus: transaction.status,
          paymentStatus: 'REVIEW_REQUIRED' as const,
          changed: false,
          membership: 'UNCHANGED' as const,
        };
      }

      const activeSubscription = await tx.subscription.findUnique({ where: { userId: current.userId } });
      const hasConflictingPeriod = Boolean(
        activeSubscription &&
          ['ACTIVE', 'TRIALING'].includes(activeSubscription.status) &&
          activeSubscription.currentPeriodEnd > new Date() &&
          activeSubscription.externalId !== transaction.id,
      );

      // Defensa para referencias históricas/reemplazadas y para cualquier
      // solapamiento que pudiera existir antes de desplegar el cerrojo actual.
      // Se reconoce el dinero recibido, pero jamás se pisa ni prolonga el plan.
      if (current.status === 'SUPERSEDED' || hasConflictingPeriod) {
        await tx.payment.update({
          where: { id: current.id },
          data: { status: 'REVIEW_REQUIRED', externalId: transaction.id, processedAt: new Date() },
        });
        await tx.notification.create({
          data: {
            userId: current.userId,
            kind: 'WARNING',
            title: 'Pago recibido en revisión',
            body: 'Detectamos un pago duplicado o un checkout reemplazado. No hagas otro intento; soporte revisará el cargo sin modificar tu membresía actual.',
            href: '/soporte',
          },
        });
        await tx.supportTicket.create({
          data: {
            userId: current.userId,
            subject: 'Revisar pago Wompi conflictivo',
            body: `Pago interno ${current.id}. Transacción recibida: ${transaction.id}. El intento estaba reemplazado o coexistía con otro periodo activo; la membresía no fue modificada.`,
            category: 'PAGOS',
            status: 'OPEN',
            priority: 'HIGH',
          },
        });
        return {
          transactionStatus: transaction.status,
          paymentStatus: 'REVIEW_REQUIRED' as const,
          changed: true,
          membership: 'UNCHANGED' as const,
        };
      }

      // La actualización condicionada reclama el pago. Incluso si dos eventos
      // idénticos compiten, solo uno puede activar y calcular el periodo.
      const claimed = await tx.payment.updateMany({
        where: { id: current.id, status: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'SUCCEEDED', externalId: transaction.id, processedAt: new Date() },
      });
      if (claimed.count !== 1) {
        const latest = await tx.payment.findUniqueOrThrow({ where: { id: current.id } });
        return {
          transactionStatus: transaction.status,
          paymentStatus: latest.status as WompiReconcileResult['paymentStatus'],
          changed: false,
          membership: 'UNCHANGED' as const,
        };
      }

      const periodStart = new Date();
      const periodDays = metadata.interval === 'YEARLY' ? 365 : 30;
      const periodEnd = new Date(periodStart.getTime() + periodDays * 86_400_000);
      await tx.subscription.upsert({
        where: { userId: current.userId },
        create: {
          userId: current.userId,
          planId: metadata.planId,
          status: 'ACTIVE',
          interval: metadata.interval,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          trialEndsAt: null,
          couponCode: null,
          externalId: transaction.id,
        },
        update: {
          planId: metadata.planId,
          status: 'ACTIVE',
          interval: metadata.interval,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          trialEndsAt: null,
          couponCode: null,
          externalId: transaction.id,
        },
      });
      await tx.notification.create({
        data: {
          userId: current.userId,
          kind: 'SUCCESS',
          title: 'Pago confirmado',
          body: `Tu plan ${metadata.planId === 'STANDARD' ? 'Standard' : 'Premium'} ya está activo.`,
          href: '/perfil',
        },
      });
      return {
        transactionStatus: transaction.status,
        paymentStatus: 'SUCCEEDED' as const,
        changed: true,
        membership: 'ACTIVE' as const,
      };
    }

    if (transaction.status === 'VOIDED') {
      if (current.status === 'REFUNDED') {
        return {
          transactionStatus: transaction.status,
          paymentStatus: 'REFUNDED' as const,
          changed: false,
          membership: 'UNCHANGED' as const,
        };
      }

      // Wompi puede crear un segundo ID con la misma referencia al reintentar
      // un pago. Un VOIDED de un intento diferente jamás revoca la membresía
      // que quedó vinculada al ID aprobado.
      if ((current.status === 'SUCCEEDED' || current.status === 'REVIEW_REQUIRED') && !sameTransaction) {
        return {
          transactionStatus: transaction.status,
          paymentStatus: 'SUCCEEDED' as const,
          changed: false,
          membership: 'UNCHANGED' as const,
        };
      }

      const hadActivated =
        (current.status === 'SUCCEEDED' || current.status === 'REVIEW_REQUIRED') && sameTransaction;
      await tx.payment.update({
        where: { id: current.id },
        data: { status: 'REFUNDED', externalId: transaction.id, processedAt: new Date() },
      });
      const canceled = hadActivated
        ? await tx.subscription.updateMany({
            where: { userId: current.userId, externalId: transaction.id },
            data: {
              status: 'CANCELED',
              cancelAtPeriodEnd: false,
              canceledAt: new Date(),
              currentPeriodEnd: new Date(),
            },
          })
        : { count: 0 };
      return {
        transactionStatus: transaction.status,
        paymentStatus: 'REFUNDED' as const,
        changed: true,
        membership: canceled.count === 1 ? ('CANCELED' as const) : ('UNCHANGED' as const),
      };
    }

    // DECLINED y ERROR solo fallan este intento. Nunca degradan una membresía
    // vigente ni revierten un APPROVED ya aplicado.
    if (current.status !== 'PENDING') {
      return {
        transactionStatus: transaction.status,
        paymentStatus: current.status as WompiReconcileResult['paymentStatus'],
        changed: false,
        membership: 'UNCHANGED' as const,
      };
    }
    await tx.payment.update({
      where: { id: current.id },
      data: { status: 'FAILED', externalId: transaction.id, processedAt: new Date() },
    });
    await tx.notification.create({
      data: {
        userId: current.userId,
        kind: 'WARNING',
        title: 'El pago no fue aprobado',
        body: 'Wompi no aprobó este intento. Puedes iniciar un pago nuevo desde tu perfil.',
        href: '/perfil',
      },
    });
    return {
      transactionStatus: transaction.status,
      paymentStatus: 'FAILED' as const,
      changed: true,
      membership: 'UNCHANGED' as const,
    };
  }, { isolationLevel: 'Serializable' });
}

export function redactedWompiEvent(event: WompiWebhookEvent): Record<string, unknown> {
  const transaction = webhookTransaction(event);
  return {
    event: event.event,
    environment: event.environment,
    timestamp: event.timestamp,
    sentAt: event.sent_at,
    signature: {
      properties: event.signature.properties,
      checksum: event.signature.checksum.toLowerCase(),
    },
    transaction: {
      id: transaction.id,
      reference: transaction.reference,
      amountInCents: transaction.amount_in_cents,
      currency: transaction.currency,
      status: transaction.status,
    },
  };
}
