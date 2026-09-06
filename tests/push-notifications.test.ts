import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Las notificaciones son la superficie más fácil de convertir en spam y la más
 * fácil de perder para siempre: una denegación del navegador es casi
 * irreversible. Aquí se fija a quién se avisa, cuándo y con qué límites.
 */

vi.mock('server-only', () => ({}));

const user = vi.hoisted(() => ({ findMany: vi.fn() }));
const pushSubscription = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));
const sendNotification = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/db', () => ({ db: { user, pushSubscription } }));
vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification },
}));

const { deliver, localHour, pendingStudyReminders, studyReminderPayload, pushConfigured } = await import(
  '../src/lib/push'
);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_PUBLIC_KEY = 'clave-publica-de-prueba';
  process.env.VAPID_PRIVATE_KEY = 'clave-privada-de-prueba';
  pushSubscription.update.mockResolvedValue({});
  pushSubscription.delete.mockResolvedValue({});
});

const device = { id: 'device-1', endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a' };

describe('configuración', () => {
  it('se declara apagada si falta cualquiera de las dos claves', () => {
    process.env.VAPID_PRIVATE_KEY = '';
    expect(pushConfigured()).toBe(false);
    process.env.VAPID_PRIVATE_KEY = 'clave';
    process.env.VAPID_PUBLIC_KEY = '';
    expect(pushConfigured()).toBe(false);
  });
});

describe('entrega', () => {
  it('marca el envío correcto y reinicia el contador de fallos', async () => {
    sendNotification.mockResolvedValue({});
    const report = await deliver([device], studyReminderPayload(0));
    expect(report).toEqual({ sent: 1, removed: 0, failed: 0 });
    expect(pushSubscription.update.mock.calls[0][0].data.failureCount).toBe(0);
  });

  it.each([404, 410])('borra la suscripción cuando el servicio responde %i', async (statusCode) => {
    sendNotification.mockRejectedValue(Object.assign(new Error('gone'), { statusCode }));
    const report = await deliver([device], studyReminderPayload(0));
    // El navegador ya no existe: reintentar sería acumular basura.
    expect(report).toEqual({ sent: 0, removed: 1, failed: 0 });
    expect(pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 'device-1' } });
  });

  it('conserva la suscripción ante un fallo transitorio', async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));
    const report = await deliver([device], studyReminderPayload(0));
    expect(report).toEqual({ sent: 0, removed: 0, failed: 1 });
    expect(pushSubscription.delete).not.toHaveBeenCalled();
    expect(pushSubscription.update.mock.calls[0][0].data.failureCount).toEqual({ increment: 1 });
  });

  it('un dispositivo caído no impide entregar al resto', async () => {
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockResolvedValueOnce({});
    const report = await deliver([device, { ...device, id: 'device-2' }], studyReminderPayload(0));
    expect(report.sent).toBe(1);
    expect(report.removed).toBe(1);
  });
});

describe('a quién se recuerda', () => {
  it('solo a quien lo pidió, tiene dispositivo y no ha estudiado hoy', async () => {
    user.findMany.mockResolvedValue([]);
    await pendingStudyReminders(new Date('2026-09-06T20:00:00Z'));
    const where = user.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('ACTIVE');
    expect(where.profile.studyReminderOptIn).toBe(true);
    expect(where.pushSubscriptions).toEqual({ some: {} });
    // Recordar a quien ya estudió es ruido, y el ruido es lo que hace que la
    // gente desactive las notificaciones.
    expect(where.OR).toEqual([
      { streakUpdatedAt: null },
      { streakUpdatedAt: { lt: new Date('2026-09-06T00:00:00Z') } },
    ]);
  });

  it('respeta la hora preferida en la zona horaria de cada persona', async () => {
    const now = new Date('2026-09-06T20:00:00Z'); // 15:00 en Bogotá
    user.findMany.mockResolvedValue([
      { id: 'a', timezone: 'America/Bogota', streakDays: 0, profile: { studyReminderHour: 15 }, pushSubscriptions: [device] },
      { id: 'b', timezone: 'America/Bogota', streakDays: 0, profile: { studyReminderHour: 20 }, pushSubscriptions: [device] },
      { id: 'c', timezone: 'Europe/Madrid', streakDays: 0, profile: { studyReminderHour: 22 }, pushSubscriptions: [device] },
    ]);
    const due = await pendingStudyReminders(now);
    expect(due.map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('cae a UTC si la zona horaria declarada no es válida', () => {
    const instant = new Date('2026-09-06T09:00:00Z');
    expect(localHour(instant, 'Zona/Inventada')).toBe(9);
    expect(localHour(instant, 'America/Bogota')).toBe(4);
  });
});

describe('contenido', () => {
  it('reconoce la racha sin inventar urgencia', () => {
    expect(studyReminderPayload(5).title).toContain('5 días');
    expect(studyReminderPayload(0).title).not.toMatch(/último|ahora|no te pierdas|urgente/i);
  });

  it('siempre lleva a la academia, nunca al terminal', () => {
    for (const streak of [0, 1, 30]) {
      expect(studyReminderPayload(streak).url).toBe('/academia');
    }
  });
});

describe('service worker', () => {
  const worker = readFileSync('public/sw.js', 'utf8');

  it('muestra siempre una notificación visible', () => {
    // Un `push` que no pinta nada hace que el navegador retire el permiso.
    expect(worker).toContain('self.registration.showNotification');
    expect(worker).toContain("addEventListener('push'");
  });

  it('nunca navega fuera del propio sitio al tocar la notificación', () => {
    expect(worker).toContain("payload.url.startsWith('/')");
    expect(worker).toContain("!payload.url.startsWith('//')");
  });

  it('reutiliza la ventana abierta en lugar de acumular pestañas', () => {
    expect(worker).toContain("matchAll({ type: 'window'");
    expect(worker).toContain('client.focus()');
  });
});
