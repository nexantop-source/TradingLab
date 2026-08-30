import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { enforce } from '@/lib/rate-limit';
import {
  fetchWompiTransaction,
  parseWompiPaymentDescription,
  readWompiConfig,
  wompiPaymentIdempotencyKey,
  WompiError,
} from '@/lib/wompi';

const transactionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,255}$/);

/**
 * Consulta de solo lectura para la pantalla de retorno. Aunque Wompi diga
 * APPROVED, este endpoint jamás activa una membresía: esa mutación pertenece
 * exclusivamente al webhook verificado e idempotente.
 */
export async function GET(req: NextRequest) {
  try {
    if ((process.env.BILLING_PROVIDER ?? 'disabled').trim().toLowerCase() !== 'wompi') {
      return fail('BILLING_PROVIDER_UNAVAILABLE', 'Wompi no está habilitado.', 404);
    }

    const { user } = await requireAuth();
    await enforce(`billing-status:${user.id}`, { limit: 20, windowSeconds: 300 });
    const transactionId = transactionIdSchema.parse(req.nextUrl.searchParams.get('id'));
    const config = readWompiConfig();
    const transaction = await fetchWompiTransaction(transactionId, config);
    const payment = await db.payment.findUnique({
      where: { idempotencyKey: wompiPaymentIdempotencyKey(transaction.reference) },
    });

    // Evita que una cuenta consulte detalles de compras pertenecientes a otra.
    if (!payment || payment.userId !== user.id) {
      return fail('TRANSACTION_NOT_FOUND', 'No se encontró esta transacción.', 404);
    }

    const metadata = parseWompiPaymentDescription(payment.description);
    // El importe queda congelado al crear Payment. Un cambio posterior de
    // precios no puede invalidar una compra legítima que ya fue firmada.
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

    const subscription = await db.subscription.findUnique({ where: { userId: user.id } });
    const membershipActive =
      payment.status === 'SUCCEEDED' &&
      subscription?.externalId === transaction.id &&
      subscription.status === 'ACTIVE' &&
      subscription.currentPeriodEnd > new Date();
    const conflictsWithCanonicalTransaction =
      transaction.status === 'APPROVED' &&
      ['SUCCEEDED', 'REFUNDED', 'REVIEW_REQUIRED'].includes(payment.status) &&
      payment.externalId !== transaction.id;
    const reviewRequired = payment.status === 'REVIEW_REQUIRED' || conflictsWithCanonicalTransaction;

    return ok(
      {
        provider: 'wompi' as const,
        transactionId: transaction.id,
        transactionStatus: transaction.status,
        paymentStatus: payment.status,
        planId: metadata.planId,
        interval: metadata.interval,
        amountInCents: expectedAmount,
        currency: 'COP' as const,
        membershipActive,
        reviewRequired,
        pendingActivation:
          transaction.status === 'APPROVED' &&
          !reviewRequired &&
          !membershipActive,
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    if (error instanceof WompiError) {
      return fail(error.code, error.message, error.status);
    }
    return handleError(error);
  }
}
