import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  outerPaymentFindUnique: vi.fn(),
  transaction: vi.fn(),
  userUpdateMany: vi.fn(),
  paymentFindUnique: vi.fn(),
  paymentFindUniqueOrThrow: vi.fn(),
  paymentFindFirst: vi.fn(),
  paymentUpdate: vi.fn(),
  paymentUpdateMany: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  subscriptionUpsert: vi.fn(),
  subscriptionUpdateMany: vi.fn(),
  notificationCreate: vi.fn(),
  supportTicketCreate: vi.fn(),
}));

const transactionClient = {
  user: {
    updateMany: mocks.userUpdateMany,
  },
  payment: {
    findUnique: mocks.paymentFindUnique,
    findUniqueOrThrow: mocks.paymentFindUniqueOrThrow,
    findFirst: mocks.paymentFindFirst,
    update: mocks.paymentUpdate,
    updateMany: mocks.paymentUpdateMany,
  },
  subscription: {
    findUnique: mocks.subscriptionFindUnique,
    upsert: mocks.subscriptionUpsert,
    updateMany: mocks.subscriptionUpdateMany,
  },
  notification: {
    create: mocks.notificationCreate,
  },
  supportTicket: {
    create: mocks.supportTicketCreate,
  },
};

vi.mock('../src/lib/db', () => ({
  db: {
    payment: {
      findUnique: mocks.outerPaymentFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  reconcileWompiTransaction,
  type WompiTransaction,
} from '../src/lib/wompi';

const REFERENCE = 'tl_snapshot_reference_001';
const SNAPSHOT_AMOUNT_CENTS = 5_990_000;
const USER_ID = 'user_reconciliation_001';

type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'REVIEW_REQUIRED';

function paymentFixture(
  status: PaymentStatus = 'PENDING',
  externalId: string | null = null,
) {
  return {
    id: 'payment_snapshot_001',
    userId: USER_ID,
    amountCents: SNAPSHOT_AMOUNT_CENTS,
    currency: 'COP',
    status,
    description: 'Suscripción Standard (mensual) [tl:wompi:v1:STANDARD:MONTHLY]',
    idempotencyKey: `wompi:${REFERENCE}`,
    externalId,
    invoiceUrl: null,
    processedAt: status === 'PENDING' ? null : new Date('2026-08-01T12:00:00.000Z'),
    createdAt: new Date('2026-08-01T11:55:00.000Z'),
  };
}

function transactionFixture(
  status: WompiTransaction['status'],
  id = 'txn_reconciliation_001',
): WompiTransaction {
  return {
    id,
    amount_in_cents: SNAPSHOT_AMOUNT_CENTS,
    reference: REFERENCE,
    currency: 'COP',
    status,
  };
}

function arrangePayment(payment = paymentFixture()) {
  mocks.outerPaymentFindUnique.mockResolvedValue(payment);
  mocks.paymentFindUnique.mockResolvedValue(payment);
  mocks.paymentFindUniqueOrThrow.mockResolvedValue(payment);
  mocks.paymentFindFirst.mockResolvedValue(null);
  mocks.paymentUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...payment,
    ...data,
  }));
  mocks.paymentUpdateMany.mockResolvedValue({ count: 1 });
  mocks.subscriptionFindUnique.mockResolvedValue(null);
  mocks.subscriptionUpsert.mockResolvedValue({ id: 'subscription_001' });
  mocks.subscriptionUpdateMany.mockResolvedValue({ count: 0 });
  mocks.notificationCreate.mockResolvedValue({ id: 'notification_001' });
  mocks.supportTicketCreate.mockResolvedValue({ id: 'ticket_001' });
  return payment;
}

describe('reconcileWompiTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(
      async (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('aprueba usando el importe inmutable guardado en Payment aunque el precio ambiental cambie', async () => {
    arrangePayment();
    vi.stubEnv('WOMPI_STANDARD_MONTHLY_AMOUNT_IN_CENTS', '9990000');

    const result = await reconcileWompiTransaction(transactionFixture('APPROVED'));

    expect(result).toMatchObject({
      transactionStatus: 'APPROVED',
      paymentStatus: 'SUCCEEDED',
      changed: true,
      membership: 'ACTIVE',
    });
    expect(mocks.paymentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'payment_snapshot_001' }),
        data: expect.objectContaining({
          status: 'SUCCEEDED',
          externalId: 'txn_reconciliation_001',
        }),
      }),
    );
    expect(mocks.subscriptionUpsert).toHaveBeenCalledTimes(1);
  });

  it('pone una segunda referencia aprobada en revisión y no sobrescribe la suscripción activa', async () => {
    arrangePayment();
    mocks.subscriptionFindUnique.mockResolvedValue({
      id: 'subscription_existing_001',
      userId: USER_ID,
      planId: 'PREMIUM',
      status: 'ACTIVE',
      interval: 'YEARLY',
      currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2027-08-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      trialEndsAt: null,
      couponCode: null,
      externalId: 'txn_already_approved_001',
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    });

    const result = await reconcileWompiTransaction(
      transactionFixture('APPROVED', 'txn_second_reference_001'),
    );

    expect(result).toMatchObject({
      transactionStatus: 'APPROVED',
      paymentStatus: 'REVIEW_REQUIRED',
      membership: 'UNCHANGED',
    });
    expect(mocks.subscriptionUpsert).not.toHaveBeenCalled();
    expect(mocks.subscriptionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.paymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment_snapshot_001' },
        data: expect.objectContaining({
          status: 'REVIEW_REQUIRED',
          externalId: 'txn_second_reference_001',
        }),
      }),
    );
  });

  it('es idempotente al recibir de nuevo un APPROVED ya aplicado', async () => {
    arrangePayment(paymentFixture('SUCCEEDED', 'txn_repeated_approved_001'));

    const result = await reconcileWompiTransaction(
      transactionFixture('APPROVED', 'txn_repeated_approved_001'),
    );

    expect(result).toEqual({
      transactionStatus: 'APPROVED',
      paymentStatus: 'SUCCEEDED',
      changed: false,
      membership: 'UNCHANGED',
    });
    expect(mocks.paymentUpdate).not.toHaveBeenCalled();
    expect(mocks.paymentUpdateMany).not.toHaveBeenCalled();
    expect(mocks.subscriptionUpsert).not.toHaveBeenCalled();
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });

  it('detecta un segundo APPROVED con la misma referencia y conserva el ID canónico', async () => {
    arrangePayment(paymentFixture('SUCCEEDED', 'txn_canonical_approved_001'));

    const result = await reconcileWompiTransaction(
      transactionFixture('APPROVED', 'txn_duplicate_approved_002'),
    );

    expect(result).toEqual({
      transactionStatus: 'APPROVED',
      paymentStatus: 'REVIEW_REQUIRED',
      changed: true,
      membership: 'UNCHANGED',
    });
    expect(mocks.subscriptionUpsert).not.toHaveBeenCalled();
    expect(mocks.paymentUpdate).toHaveBeenCalledWith({
      where: { id: 'payment_snapshot_001' },
      data: { status: 'REVIEW_REQUIRED' },
    });
    expect(mocks.notificationCreate).toHaveBeenCalledTimes(1);
    expect(mocks.supportTicketCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        category: 'PAGOS',
        status: 'OPEN',
        priority: 'HIGH',
      }),
    });
  });

  it.each(['PENDING', 'DECLINED', 'VOIDED'] as const)(
    'ignora un %s tardío de otro ID sin alterar el pago aprobado canónico',
    async (lateStatus) => {
      arrangePayment(paymentFixture('SUCCEEDED', 'txn_canonical_approved_001'));

      const result = await reconcileWompiTransaction(
        transactionFixture(lateStatus, `txn_late_${lateStatus.toLowerCase()}_002`),
      );

      expect(result).toMatchObject({
        transactionStatus: lateStatus,
        paymentStatus: 'SUCCEEDED',
        changed: false,
        membership: 'UNCHANGED',
      });
      expect(mocks.paymentUpdate).not.toHaveBeenCalled();
      expect(mocks.paymentUpdateMany).not.toHaveBeenCalled();
      expect(mocks.subscriptionUpsert).not.toHaveBeenCalled();
      expect(mocks.subscriptionUpdateMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['DECLINED', 'FAILED'],
    ['VOIDED', 'REFUNDED'],
  ] as const)('%s nunca activa una membresía', async (transactionStatus, paymentStatus) => {
    arrangePayment();

    const result = await reconcileWompiTransaction(transactionFixture(transactionStatus));

    expect(result).toMatchObject({
      transactionStatus,
      paymentStatus,
      membership: 'UNCHANGED',
    });
    expect(mocks.subscriptionUpsert).not.toHaveBeenCalled();
  });
});
