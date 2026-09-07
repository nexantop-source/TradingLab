import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Prueba gratuita con cobro posterior. Es dinero de otras personas, así que lo
 * que se fija aquí no es que "funcione", sino que no pueda cobrar de más:
 * quién es elegible, qué se le anuncia antes de aceptar, y qué hace falta para
 * que un cobro salga.
 */

vi.mock('server-only', () => ({}));

const subscription = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), upsert: vi.fn() }));
const billingMandate = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() }));
const payment = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
const paymentSource = vi.hoisted(() => ({ upsert: vi.fn() }));
const notification = vi.hoisted(() => ({ create: vi.fn() }));
const chargePaymentSource = vi.hoisted(() => vi.fn());
const createPaymentSource = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/db', () => ({
  db: {
    subscription,
    billingMandate,
    payment,
    paymentSource,
    notification,
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({ subscription, billingMandate, payment, paymentSource, notification }),
  },
}));
vi.mock('../src/lib/wompi-recurring', () => ({ chargePaymentSource, createPaymentSource }));
vi.mock('../src/lib/analytics', () => ({ track: vi.fn(), audit: vi.fn() }));

const {
  MAX_CHARGE_ATTEMPTS,
  TRIAL_DAYS,
  TRIAL_PLANS,
  cancelTrial,
  chargeDueSubscriptions,
  mandateText,
  trialEligibility,
  TrialError,
} = await import('../src/lib/trials');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WOMPI_ENVIRONMENT = 'sandbox';
  process.env.WOMPI_PUBLIC_KEY = 'pub_test_fixture';
  process.env.WOMPI_PRIVATE_KEY = 'prv_test_fixture';
  process.env.WOMPI_INTEGRITY_SECRET = 'test_integrity_fixture';
  process.env.WOMPI_EVENTS_SECRET = 'test_events_fixture';
  process.env.WOMPI_PRICING_MODE = 'fixed_cop';
  process.env.WOMPI_PREMIUM_MONTHLY_AMOUNT_IN_CENTS = '11990000';
  subscription.update.mockResolvedValue({});
  subscription.upsert.mockResolvedValue({});
  billingMandate.updateMany.mockResolvedValue({});
  payment.create.mockResolvedValue({});
  payment.update.mockResolvedValue({});
  notification.create.mockResolvedValue({});
});

describe('alcance de la prueba', () => {
  it('la ofrecen los dos planes de pago, nunca el gratuito', () => {
    expect(TRIAL_PLANS).toEqual(['STANDARD', 'PREMIUM']);
    expect(TRIAL_DAYS).toBe(7);
  });
});

describe('elegibilidad', () => {
  it('la concede a una cuenta nueva', async () => {
    subscription.findUnique.mockResolvedValue(null);
    billingMandate.findFirst.mockResolvedValue(null);
    expect(await trialEligibility('u1')).toMatchObject({ eligible: true, reason: 'OK' });
  });

  it('la niega si ya hay un periodo vigente', async () => {
    subscription.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });
    billingMandate.findFirst.mockResolvedValue(null);
    expect(await trialEligibility('u1')).toMatchObject({ reason: 'ALREADY_SUBSCRIBED' });
  });

  it('la niega si la cuenta ya usó una, aunque la haya cancelado', async () => {
    // Se mira el histórico de mandatos, no la suscripción actual: cancelar y
    // volver a empezar no puede regalar pruebas encadenadas.
    subscription.findUnique.mockResolvedValue(null);
    billingMandate.findFirst.mockResolvedValue({ id: 'm1' });
    expect(await trialEligibility('u1')).toMatchObject({ reason: 'TRIAL_ALREADY_USED' });
  });
});

describe('texto del mandato', () => {
  const base = {
    planId: 'PREMIUM' as const,
    interval: 'MONTHLY' as const,
    trialDays: 7,
    firstChargeAt: new Date('2026-09-13T12:00:00Z'),
    usdCents: 2999,
    pricingMode: 'usd_trm' as const,
  };

  it('dice el precio, la fecha del primer cobro y cómo cancelar', () => {
    const text = mandateText(base);
    expect(text).toContain('USD 29.99');
    expect(text).toContain('7 días no se cobra nada');
    expect(text).toMatch(/13 de septiembre de 2026/);
    expect(text).toContain('Puedo cancelar en cualquier momento');
  });

  it('declara la regla de conversión que se aplicará', () => {
    expect(mandateText(base)).toContain('TRM vigente el día del cobro');
    expect(mandateText({ ...base, pricingMode: 'fixed_cop' })).toContain('importe fijo publicado');
  });

  it('no promete gestión de dinero real', () => {
    expect(mandateText(base)).toContain('nunca a la gestión de dinero real');
  });
});

describe('cancelación', () => {
  it('revoca el mandato y quita la fecha de cobro', async () => {
    subscription.findUnique.mockResolvedValue({
      source: 'TRIAL',
      nextChargeAt: new Date(Date.now() + 86_400_000),
      currentPeriodEnd: new Date(Date.now() + 3 * 86_400_000),
    });
    const result = await cancelTrial({ userId: 'u1' });

    expect(billingMandate.updateMany).toHaveBeenCalledOnce();
    expect(billingMandate.updateMany.mock.calls[0][0].where.revokedAt).toBeNull();
    // Sin próxima fecha no hay nada que cobrar: es el interruptor real.
    expect(subscription.update.mock.calls[0][0].data.nextChargeAt).toBeNull();
    expect(result.charged).toBe(false);
  });

  it('conserva el acceso ya concedido', async () => {
    const accessUntil = new Date(Date.now() + 3 * 86_400_000);
    subscription.findUnique.mockResolvedValue({
      source: 'TRIAL',
      nextChargeAt: new Date(),
      currentPeriodEnd: accessUntil,
    });
    expect((await cancelTrial({ userId: 'u1' })).accessUntil).toEqual(accessUntil);
    expect(subscription.update.mock.calls[0][0].data.currentPeriodEnd).toBeUndefined();
  });

  it('no toca una suscripción que no sea una prueba', async () => {
    subscription.findUnique.mockResolvedValue({ source: 'CHECKOUT', nextChargeAt: null });
    await expect(cancelTrial({ userId: 'u1' })).rejects.toBeInstanceOf(TrialError);
    expect(subscription.update).not.toHaveBeenCalled();
  });
});

describe('cobro programado', () => {
  const due = {
    userId: 'u1',
    planId: 'PREMIUM',
    interval: 'MONTHLY',
    chargeAttempts: 0,
    user: { id: 'u1', email: 'alumna@correo.com', status: 'ACTIVE' },
    paymentSource: { wompiId: 4242, status: 'ACTIVE' },
  };

  it('no cobra sin un mandato vigente', async () => {
    subscription.findMany.mockResolvedValue([due]);
    billingMandate.findFirst.mockResolvedValue(null);
    const report = await chargeDueSubscriptions();
    expect(report.skipped).toBe(1);
    expect(chargePaymentSource).not.toHaveBeenCalled();
    // Y se limpia la fecha para no reintentar en bucle.
    expect(subscription.update.mock.calls[0][0].data.nextChargeAt).toBeNull();
  });

  it('no cobra a una cuenta suspendida', async () => {
    subscription.findMany.mockResolvedValue([{ ...due, user: { ...due.user, status: 'SUSPENDED' } }]);
    billingMandate.findFirst.mockResolvedValue({ id: 'm1' });
    expect((await chargeDueSubscriptions()).skipped).toBe(1);
    expect(chargePaymentSource).not.toHaveBeenCalled();
  });

  it('crea el pago antes de llamar a Wompi, para no dejar cobros huérfanos', async () => {
    subscription.findMany.mockResolvedValue([due]);
    billingMandate.findFirst.mockResolvedValue({ id: 'm1' });
    const order: string[] = [];
    payment.create.mockImplementation(async () => {
      order.push('payment');
      return {};
    });
    chargePaymentSource.mockImplementation(async () => {
      order.push('wompi');
      return { status: 'PENDING', transactionId: 't1', statusMessage: null };
    });
    await chargeDueSubscriptions();

    // Si la llamada a Wompi se pierde por red, el rastro ya existe y se puede
    // conciliar por webhook en lugar de quedar un cobro sin dueño.
    expect(order).toEqual(['payment', 'wompi']);
    expect(payment.create.mock.calls[0][0].data.status).toBe('PENDING');
    expect(payment.create.mock.calls[0][0].data.currency).toBe('COP');
  });

  it('un PENDING no concede acceso: solo retira la fecha para no cobrar dos veces', async () => {
    subscription.findMany.mockResolvedValue([due]);
    billingMandate.findFirst.mockResolvedValue({ id: 'm1' });
    chargePaymentSource.mockResolvedValue({ status: 'PENDING', transactionId: 't1', statusMessage: null });
    await chargeDueSubscriptions();
    const written = subscription.update.mock.calls[0][0].data;
    expect(written.nextChargeAt).toBeNull();
    expect(written.status).toBeUndefined();
    expect(written.currentPeriodEnd).toBeUndefined();
  });

  it('un rechazo programa un reintento y avisa', async () => {
    subscription.findMany.mockResolvedValue([due]);
    billingMandate.findFirst.mockResolvedValue({ id: 'm1' });
    chargePaymentSource.mockResolvedValue({ status: 'DECLINED', transactionId: 't1', statusMessage: 'Fondos insuficientes' });
    const report = await chargeDueSubscriptions();

    expect(report.declined).toBe(1);
    const written = subscription.update.mock.calls[0][0].data;
    expect(written.status).toBe('PAST_DUE');
    expect(written.chargeAttempts).toBe(1);
    expect(written.nextChargeAt).toBeInstanceOf(Date);
    expect(notification.create).toHaveBeenCalledOnce();
  });

  it('deja de intentarlo tras el último intento', async () => {
    subscription.findMany.mockResolvedValue([{ ...due, chargeAttempts: MAX_CHARGE_ATTEMPTS - 1 }]);
    billingMandate.findFirst.mockResolvedValue({ id: 'm1' });
    chargePaymentSource.mockResolvedValue({ status: 'DECLINED', transactionId: 't1', statusMessage: null });
    await chargeDueSubscriptions();
    expect(subscription.update.mock.calls[0][0].data.nextChargeAt).toBeNull();
  });

  it('usa una referencia distinta en cada intento', async () => {
    subscription.findMany.mockResolvedValue([due, { ...due, userId: 'u2', user: { ...due.user, id: 'u2' } }]);
    billingMandate.findFirst.mockResolvedValue({ id: 'm1' });
    chargePaymentSource.mockResolvedValue({ status: 'PENDING', transactionId: 't1', statusMessage: null });
    await chargeDueSubscriptions();
    const [first, second] = chargePaymentSource.mock.calls.map((call) => call[0].reference);
    expect(first).not.toBe(second);
    // Wompi rechaza una referencia repetida: es la red contra el doble cobro.
    expect(first).toMatch(/^tl_r_/);
  });
});
