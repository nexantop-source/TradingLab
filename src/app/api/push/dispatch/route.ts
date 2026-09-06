import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { deliver, pendingStudyReminders, pushConfigured, studyReminderPayload } from '@/lib/push';

export const dynamic = 'force-dynamic';

/**
 * Despachador de recordatorios de estudio.
 *
 * Lo invoca un programador externo (Cloud Scheduler en Firebase App Hosting)
 * una vez por hora. Cada ejecución solo avisa a quien tiene esa hora como
 * preferida en su zona horaria, así que las 24 ejecuciones diarias cubren el
 * mundo sin despertar a nadie de madrugada.
 *
 * No se autentica por cookie porque no lo llama una persona: usa un secreto
 * compartido comparado en tiempo constante. Sin `PUSH_DISPATCH_SECRET`
 * definido, la ruta responde 503 y no envía nada, en lugar de quedar abierta.
 */
export async function POST(req: NextRequest) {
  try {
    const expected = process.env.PUSH_DISPATCH_SECRET?.trim();
    if (!expected) {
      return fail('DISPATCH_NOT_CONFIGURED', 'El despachador de notificaciones no está configurado.', 503);
    }
    if (!authorized(req.headers.get('authorization'), expected)) {
      return fail('UNAUTHORIZED', 'Credencial de despachador no válida.', 401);
    }
    if (!pushConfigured()) {
      return fail('PUSH_NOT_CONFIGURED', 'Faltan las claves VAPID.', 503);
    }

    const due = await pendingStudyReminders();
    const totals = { users: due.length, sent: 0, removed: 0, failed: 0 };

    for (const person of due) {
      const report = await deliver(person.pushSubscriptions, studyReminderPayload(person.streakDays));
      totals.sent += report.sent;
      totals.removed += report.removed;
      totals.failed += report.failed;
    }

    return ok(totals);
  } catch (error) {
    return handleError(error);
  }
}

/** Comparación en tiempo constante: una comparación normal filtra el secreto. */
function authorized(header: string | null, expected: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const provided = Buffer.from(header.slice(7));
  const target = Buffer.from(expected);
  if (provided.length !== target.length) return false;
  return timingSafeEqual(provided, target);
}
