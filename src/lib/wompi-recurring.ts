import 'server-only';
import { z } from 'zod';
import { readWompiConfig, WompiError, wompiIntegritySignature, type WompiConfig } from './wompi';

/**
 * Cobros con tarjeta guardada (fuentes de pago de Wompi).
 *
 * El reparto de responsabilidades es lo que mantiene esta instalación fuera del
 * alcance completo de PCI-DSS:
 *
 *   · El **navegador** tokeniza la tarjeta contra Wompi con la llave pública.
 *     El PAN y el CVC nunca llegan a este servidor, ni a sus registros, ni a la
 *     analítica.
 *   · El **servidor** recibe únicamente un token de un solo uso, lo canjea por
 *     una fuente de pago con la llave privada y guarda el identificador.
 *
 * La llave privada solo se usa aquí. Si falta, ninguna de estas funciones
 * puede operar y se dice explícitamente en lugar de fallar a medias.
 */

const TIMEOUT_MS = 15_000;

function requirePrivateKey(config: WompiConfig): string {
  if (!config.privateKey) {
    throw new WompiError(
      'WOMPI_PRIVATE_KEY_MISSING',
      'Cobrar una tarjeta guardada requiere WOMPI_PRIVATE_KEY, que no está configurada en este despliegue.',
      503,
    );
  }
  return config.privateKey;
}

async function wompiFetch(
  url: string,
  init: RequestInit & { authorization: string },
): Promise<unknown> {
  const { authorization, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        ...(rest.headers ?? {}),
        Authorization: `Bearer ${authorization}`,
        'Content-Type': 'application/json',
      },
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      throw new WompiError('WOMPI_BAD_RESPONSE', 'Wompi devolvió una respuesta ilegible.', 502);
    }
    if (!response.ok) {
      // El mensaje de Wompi puede contener detalles de la tarjeta: no se
      // propaga al cliente tal cual, solo se registra el código.
      const reason =
        (body as { error?: { type?: string; reason?: string } })?.error?.type ??
        `HTTP_${response.status}`;
      throw new WompiError('WOMPI_REQUEST_FAILED', `Wompi rechazó la operación (${reason}).`, 502);
    }
    return body;
  } catch (error) {
    if (error instanceof WompiError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new WompiError('WOMPI_TIMEOUT', 'Wompi no respondió a tiempo.', 504);
    }
    throw new WompiError('WOMPI_UNREACHABLE', 'No pudimos contactar con Wompi.', 502);
  } finally {
    clearTimeout(timer);
  }
}

// ── Tokens de aceptación ────────────────────────────────────────────────────

const acceptanceSchema = z.object({
  data: z.object({
    presigned_acceptance: z.object({
      acceptance_token: z.string().min(10),
      permalink: z.string().url(),
    }),
    presigned_personal_data_auth: z.object({
      acceptance_token: z.string().min(10),
      permalink: z.string().url(),
    }),
  }),
});

export interface AcceptanceTokens {
  termsToken: string;
  termsUrl: string;
  personalDataToken: string;
  personalDataUrl: string;
  publicKey: string;
  /** Base de la API donde el navegador debe tokenizar la tarjeta. */
  tokenizationUrl: string;
  environment: 'sandbox' | 'production';
}

/**
 * Tokens que Wompi exige para poder guardar una tarjeta.
 *
 * Son dos consentimientos distintos y ninguno se puede dar por supuesto: los
 * términos del servicio y la autorización de tratamiento de datos personales.
 * Se sirven al cliente junto con sus enlaces para que la persona pueda leer
 * exactamente lo que acepta.
 */
export async function acceptanceTokens(): Promise<AcceptanceTokens> {
  const config = readWompiConfig(process.env, { requireIntegrity: true });
  const body = await wompiFetch(`${config.apiBaseUrl}/merchants/${config.publicKey}`, {
    method: 'GET',
    authorization: config.publicKey,
  });
  const parsed = acceptanceSchema.safeParse(body);
  if (!parsed.success) {
    throw new WompiError('WOMPI_BAD_RESPONSE', 'Wompi no devolvió los tokens de aceptación.', 502);
  }
  return {
    termsToken: parsed.data.data.presigned_acceptance.acceptance_token,
    termsUrl: parsed.data.data.presigned_acceptance.permalink,
    personalDataToken: parsed.data.data.presigned_personal_data_auth.acceptance_token,
    personalDataUrl: parsed.data.data.presigned_personal_data_auth.permalink,
    publicKey: config.publicKey,
    tokenizationUrl: `${config.apiBaseUrl}/tokens/cards`,
    environment: config.environment,
  };
}

// ── Fuente de pago ──────────────────────────────────────────────────────────

const paymentSourceSchema = z.object({
  data: z.object({
    id: z.number().int().positive(),
    status: z.string(),
    public_data: z
      .object({
        brand: z.string().optional(),
        last_four: z.string().optional(),
        exp_month: z.string().optional(),
        exp_year: z.string().optional(),
      })
      .partial()
      .optional(),
  }),
});

export interface CreatedPaymentSource {
  wompiId: number;
  environment: 'sandbox' | 'production';
  brand: string | null;
  lastFour: string | null;
  expMonth: string | null;
  expYear: string | null;
}

/**
 * Canjea el token de un solo uso del navegador por una fuente de pago
 * reutilizable. Es la única operación que necesita la llave privada además del
 * cobro.
 */
export async function createPaymentSource(params: {
  cardToken: string;
  acceptanceToken: string;
  personalDataToken: string;
  email: string;
}): Promise<CreatedPaymentSource> {
  const config = readWompiConfig(process.env, { requireIntegrity: true });
  const privateKey = requirePrivateKey(config);

  const body = await wompiFetch(`${config.apiBaseUrl}/payment_sources`, {
    method: 'POST',
    authorization: privateKey,
    body: JSON.stringify({
      type: 'CARD',
      token: params.cardToken,
      customer_email: params.email,
      acceptance_token: params.acceptanceToken,
      accept_personal_auth: params.personalDataToken,
    }),
  });

  const parsed = paymentSourceSchema.safeParse(body);
  if (!parsed.success) {
    throw new WompiError('WOMPI_BAD_RESPONSE', 'Wompi no devolvió una fuente de pago válida.', 502);
  }
  if (parsed.data.data.status !== 'AVAILABLE') {
    throw new WompiError(
      'PAYMENT_SOURCE_UNAVAILABLE',
      'Tu banco no dejó guardar esta tarjeta para cobros futuros. Prueba con otra.',
      402,
    );
  }

  const info = parsed.data.data.public_data ?? {};
  return {
    wompiId: parsed.data.data.id,
    environment: config.environment,
    brand: info.brand ?? null,
    lastFour: info.last_four ?? null,
    expMonth: info.exp_month ?? null,
    expYear: info.exp_year ?? null,
  };
}

// ── Cobro ───────────────────────────────────────────────────────────────────

const transactionSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    status: z.enum(['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR']),
    status_message: z.string().nullish(),
    amount_in_cents: z.number().int(),
    reference: z.string().min(1),
  }),
});

export interface ChargeResult {
  transactionId: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';
  statusMessage: string | null;
  amountInCents: number;
  reference: string;
}

/**
 * Cobra una fuente de pago guardada.
 *
 * `reference` debe ser único y estable por intento: Wompi lo rechaza si se
 * repite, y esa es precisamente la red que impide cobrar dos veces el mismo
 * periodo si el programador se ejecuta por duplicado.
 *
 * Un resultado `PENDING` **no** es un cobro: la transacción se resuelve más
 * tarde por webhook. Conceder acceso aquí sería regalar el periodo ante una
 * transacción que puede acabar rechazada.
 */
export async function chargePaymentSource(params: {
  paymentSourceId: number;
  amountInCents: number;
  reference: string;
  email: string;
}): Promise<ChargeResult> {
  const config = readWompiConfig(process.env, { requireIntegrity: true });
  const privateKey = requirePrivateKey(config);

  if (!Number.isSafeInteger(params.amountInCents) || params.amountInCents <= 0) {
    throw new WompiError('INVALID_AMOUNT', 'El importe del cobro no es válido.', 400);
  }

  const signature = wompiIntegritySignature(
    params.reference,
    params.amountInCents,
    config.integritySecret,
  );

  const body = await wompiFetch(`${config.apiBaseUrl}/transactions`, {
    method: 'POST',
    authorization: privateKey,
    body: JSON.stringify({
      amount_in_cents: params.amountInCents,
      currency: 'COP',
      customer_email: params.email,
      reference: params.reference,
      payment_source_id: params.paymentSourceId,
      signature,
      // Wompi rechaza el cobro sin número de cuotas, aunque sea una sola.
      payment_method: { installments: 1 },
      // Marca la transacción como iniciada por el comercio. Las redes de tarjeta
      // tratan distinto un cobro recurrente de uno hecho por el titular en ese
      // momento, y declararlo mal es motivo de contracargo.
      recurrent: true,
      // Sin `redirect_url`: no hay navegador esperando. Es un cobro de fondo.
    }),
  });

  const parsed = transactionSchema.safeParse(body);
  if (!parsed.success) {
    throw new WompiError('WOMPI_BAD_RESPONSE', 'Wompi no devolvió una transacción legible.', 502);
  }
  if (parsed.data.data.reference !== params.reference) {
    throw new WompiError('WOMPI_REFERENCE_MISMATCH', 'La transacción no corresponde al cobro solicitado.', 502);
  }

  return {
    transactionId: parsed.data.data.id,
    status: parsed.data.data.status,
    statusMessage: parsed.data.data.status_message ?? null,
    amountInCents: parsed.data.data.amount_in_cents,
    reference: parsed.data.data.reference,
  };
}
