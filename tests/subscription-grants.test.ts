import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Una cortesía concede los mismos derechos que una suscripción pagada, así que
 * su corrección se comprueba con el mismo rigor: a quién se le puede conceder,
 * qué estado de facturación no puede pisar y qué queda registrado.
 */

vi.mock('server-only', () => ({}));

const user = vi.hoisted(() => ({ findUnique: vi.fn() }));
const subscription = vi.hoisted(() => ({ upsert: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() }));
const notification = vi.hoisted(() => ({ create: vi.fn() }));
const auditSpy = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/db', () => ({ db: { user, subscription, notification } }));
vi.mock('../src/lib/analytics', () => ({ audit: auditSpy }));

const { grantSubscription, revokeGrant, GrantError, MAX_GRANT_DAYS } = await import(
  '../src/lib/subscription-grants'
);

const ACTOR = { actorId: 'admin-1', actorRole: 'SUPER_ADMIN' };
const RECIPIENT = { id: 'user-1', email: 'alumna@correo.com', name: 'Alumna', status: 'ACTIVE' };

function grant(overrides: Record<string, unknown> = {}) {
  return grantSubscription({
    email: 'alumna@correo.com',
    plan: 'PREMIUM',
    days: 30,
    reason: 'Compensación por incidencia de facturación.',
    ...ACTOR,
    ...overrides,
  } as Parameters<typeof grantSubscription>[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  user.findUnique.mockResolvedValue({ ...RECIPIENT, subscription: null });
  subscription.upsert.mockResolvedValue({});
  subscription.update.mockResolvedValue({});
  notification.create.mockResolvedValue({});
});

describe('a quién se le puede conceder', () => {
  it('rechaza una cuenta que no existe', async () => {
    user.findUnique.mockResolvedValue(null);
    await expect(grant()).rejects.toThrow(GrantError);
    expect(subscription.upsert).not.toHaveBeenCalled();
  });

  it('rechaza una cuenta suspendida o eliminada', async () => {
    for (const status of ['SUSPENDED', 'DELETED']) {
      user.findUnique.mockResolvedValue({ ...RECIPIENT, status, subscription: null });
      await expect(grant()).rejects.toThrow(GrantError);
    }
    expect(subscription.upsert).not.toHaveBeenCalled();
  });
});

describe('convivencia con la facturación', () => {
  it.each(['ACTIVE', 'TRIALING', 'PAST_DUE'])(
    'no pisa una suscripción de pago vigente en estado %s',
    async (status) => {
      user.findUnique.mockResolvedValue({
        ...RECIPIENT,
        subscription: {
          source: 'CHECKOUT',
          status,
          currentPeriodEnd: new Date(Date.now() + 10 * 86_400_000),
        },
      });
      await expect(grant()).rejects.toMatchObject({ code: 'PAID_SUBSCRIPTION_ACTIVE' });
      expect(subscription.upsert).not.toHaveBeenCalled();
    },
  );

  it('sí sustituye una suscripción de pago ya vencida', async () => {
    user.findUnique.mockResolvedValue({
      ...RECIPIENT,
      subscription: {
        source: 'CHECKOUT',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() - 86_400_000),
      },
    });
    const result = await grant();
    expect(result.plan).toBe('PREMIUM');
    expect(subscription.upsert).toHaveBeenCalledOnce();
  });

  it('sustituye una cortesía anterior y lo declara', async () => {
    user.findUnique.mockResolvedValue({
      ...RECIPIENT,
      subscription: {
        source: 'GRANT',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 5 * 86_400_000),
      },
    });
    const result = await grant();
    expect(result.replacedPreviousGrant).toBe(true);
  });
});

describe('qué se escribe', () => {
  it('marca el origen como GRANT y no deja residuo de facturación', async () => {
    await grant();
    const written = subscription.upsert.mock.calls[0][0].update;
    expect(written.source).toBe('GRANT');
    expect(written.status).toBe('ACTIVE');
    expect(written.externalId).toBeNull();
    expect(written.couponCode).toBeNull();
    expect(written.canceledAt).toBeNull();
    expect(written.grantedById).toBe('admin-1');
    expect(written.grantedReason).toBe('Compensación por incidencia de facturación.');
  });

  it('calcula el vencimiento a partir de la duración concedida', async () => {
    const before = Date.now();
    const result = await grant({ days: 90 });
    const elapsed = result.currentPeriodEnd.getTime() - before;
    expect(elapsed).toBeGreaterThan(89 * 86_400_000);
    expect(elapsed).toBeLessThanOrEqual(90 * 86_400_000 + 5_000);
  });

  it('acota la duración al máximo permitido', async () => {
    const result = await grant({ days: 99_999 });
    const days = Math.round((result.currentPeriodEnd.getTime() - Date.now()) / 86_400_000);
    expect(days).toBeLessThanOrEqual(MAX_GRANT_DAYS);
  });

  it('avisa a la persona destinataria dentro de la app', async () => {
    await grant();
    expect(notification.create).toHaveBeenCalledOnce();
    const created = notification.create.mock.calls[0][0].data;
    expect(created.userId).toBe('user-1');
    expect(created.body).toContain('No se te cobrará');
  });

  it('deja constancia en la auditoría de quién, a quién y por qué', async () => {
    await grant();
    expect(auditSpy).toHaveBeenCalledOnce();
    const entry = auditSpy.mock.calls[0][0];
    expect(entry.action).toBe('subscription.grant');
    expect(entry.actorId).toBe('admin-1');
    expect(entry.diff.recipientEmail).toBe('alumna@correo.com');
    expect(entry.diff.reason).toBe('Compensación por incidencia de facturación.');
    expect(entry.diff.selfGrant).toBe(false);
  });

  it('señala explícitamente una concesión a uno mismo', async () => {
    user.findUnique.mockResolvedValue({ ...RECIPIENT, id: 'admin-1', subscription: null });
    await grant();
    expect(auditSpy.mock.calls[0][0].diff.selfGrant).toBe(true);
  });
});

describe('retirada', () => {
  it('no toca una suscripción de pago', async () => {
    subscription.findUnique.mockResolvedValue({
      source: 'CHECKOUT',
      planId: 'PREMIUM',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
      user: { email: 'alumna@correo.com' },
    });
    await expect(revokeGrant({ userId: 'user-1', reason: 'Ya no aplica.', ...ACTOR })).rejects.toMatchObject({
      code: 'NOT_A_GRANT',
    });
    expect(subscription.update).not.toHaveBeenCalled();
  });

  it('cierra la cortesía de inmediato y la audita', async () => {
    subscription.findUnique.mockResolvedValue({
      source: 'GRANT',
      planId: 'PREMIUM',
      currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
      user: { email: 'alumna@correo.com' },
    });
    await revokeGrant({ userId: 'user-1', reason: 'La incidencia quedó resuelta.', ...ACTOR });

    const written = subscription.update.mock.calls[0][0].data;
    expect(written.status).toBe('CANCELED');
    expect(written.cancelAtPeriodEnd).toBe(false);
    expect(written.currentPeriodEnd.getTime()).toBeLessThanOrEqual(Date.now());

    const entry = auditSpy.mock.calls[0][0];
    expect(entry.action).toBe('subscription.revoke_grant');
    expect(entry.diff.remainingDays).toBe(20);
  });

  it('rechaza una cuenta sin suscripción', async () => {
    subscription.findUnique.mockResolvedValue(null);
    await expect(revokeGrant({ userId: 'user-1', reason: 'Sin motivo.', ...ACTOR })).rejects.toMatchObject({
      code: 'NO_SUBSCRIPTION',
    });
  });
});
