import 'server-only';
import webpush from 'web-push';
import { db } from './db';
import { ConfigurationError } from './auth';

/**
 * Notificaciones push.
 *
 * Sirven a una sola cosa: sostener el hábito de estudio. No se usan para
 * marketing, ni para alertas de precio que inviten a operar por impulso —esta
 * es una plataforma educativa y una notificación que empuja a "no perderse un
 * movimiento" trabajaría contra su propósito—. El recordatorio diario es
 * explícitamente opcional y se apaga desde el perfil.
 *
 * Una suscripción que el servicio rechaza de forma definitiva (404/410) se
 * borra en lugar de reintentarse: el navegador ya no existe.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Ruta interna a abrir al tocar la notificación. */
  url: string;
  /** Agrupa notificaciones del mismo tipo para que no se acumulen. */
  tag: string;
}

let configured = false;

/** Clave pública VAPID, apta para el cliente. La privada nunca sale del servidor. */
export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim());
}

function configure(): void {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    throw new ConfigurationError(
      'Las notificaciones no están configuradas. Define VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (genéralas con `npx web-push generate-vapid-keys`).',
    );
  }
  // El `subject` debe ser un mailto: o una URL de contacto: es a quién avisa el
  // servicio de push si nuestros envíos dan problemas.
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:soporte@tradinglab.app';
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface DeliveryReport {
  sent: number;
  removed: number;
  failed: number;
}

/** Envía una notificación a todos los dispositivos de una cuenta. */
export async function sendToUser(userId: string, payload: PushPayload): Promise<DeliveryReport> {
  configure();
  const subscriptions = await db.pushSubscription.findMany({ where: { userId } });
  return deliver(subscriptions, payload);
}

export async function deliver(
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload,
): Promise<DeliveryReport> {
  configure();
  const report: DeliveryReport = { sent: 0, removed: 0, failed: 0 };
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          body,
          { TTL: 12 * 3600, urgency: 'low' },
        );
        report.sent++;
        await db.pushSubscription.update({
          where: { id: subscription.id },
          data: { lastSuccessAt: new Date(), failureCount: 0 },
        });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404 y 410 significan que el navegador ya no existe: reintentar sería
        // acumular basura y gastar cuota del servicio.
        if (status === 404 || status === 410) {
          await db.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => null);
          report.removed++;
          return;
        }
        report.failed++;
        await db.pushSubscription
          .update({ where: { id: subscription.id }, data: { failureCount: { increment: 1 } } })
          .catch(() => null);
      }
    }),
  );

  return report;
}

/**
 * Personas a las que toca recordar hoy.
 *
 * Se avisa a quien lo pidió, tiene al menos un dispositivo registrado y **no**
 * ha estudiado hoy: recordar a quien ya ha hecho su lección sería ruido, y el
 * ruido es lo que hace que se desactiven las notificaciones.
 *
 * `hour` es la hora UTC en la que corre el despachador; se compara con la hora
 * preferida convertida desde la zona declarada por cada persona.
 */
export async function pendingStudyReminders(now = new Date()) {
  const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const candidates = await db.user.findMany({
    where: {
      status: 'ACTIVE',
      profile: { studyReminderOptIn: true },
      pushSubscriptions: { some: {} },
      OR: [{ streakUpdatedAt: null }, { streakUpdatedAt: { lt: startOfDayUtc } }],
    },
    select: {
      id: true,
      name: true,
      timezone: true,
      streakDays: true,
      profile: { select: { studyReminderHour: true } },
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
    },
  });

  return candidates.filter((candidate) => {
    const preferred = candidate.profile?.studyReminderHour ?? 20;
    return localHour(now, candidate.timezone) === preferred;
  });
}

/** Hora local de una zona horaria IANA, sin dependencias externas. */
export function localHour(instant: Date, timezone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(instant);
    const hour = Number(formatted);
    return Number.isFinite(hour) ? hour % 24 : instant.getUTCHours();
  } catch {
    // Una zona horaria inválida no puede impedir el recordatorio: se cae a UTC.
    return instant.getUTCHours();
  }
}

/** Texto del recordatorio. Reconoce la racha sin inventar urgencia. */
export function studyReminderPayload(streakDays: number): PushPayload {
  if (streakDays >= 2) {
    return {
      title: `Llevas ${streakDays} días seguidos`,
      body: 'Una lección corta mantiene la racha. Sin prisa: el objetivo es el criterio, no el número.',
      url: '/academia',
      tag: 'study-reminder',
    };
  }
  return {
    title: 'Tu lección de hoy te espera',
    body: 'Diez minutos de estudio valen más que una hora mirando gráficos.',
    url: '/academia',
    tag: 'study-reminder',
  };
}
