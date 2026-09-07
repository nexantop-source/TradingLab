import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { chargeDueSubscriptions } from '@/lib/trials';

export const dynamic = 'force-dynamic';

/**
 * Cobra las suscripciones cuya prueba ha vencido.
 *
 * Lo invoca un programador externo (Cloud Scheduler), no una persona, así que
 * se autentica con un secreto comparado en tiempo constante en lugar de por
 * cookie. Comparte el secreto con el despachador de notificaciones porque
 * ambos son el mismo tipo de invocador de confianza.
 *
 * Sin `PUSH_DISPATCH_SECRET` responde 503 y no cobra nada, en lugar de quedar
 * abierta: una ruta de cobro accesible sin credencial es dinero de otras
 * personas al alcance de cualquiera.
 */
export async function POST(req: NextRequest) {
  try {
    const expected = process.env.PUSH_DISPATCH_SECRET?.trim();
    if (!expected) {
      return fail('DISPATCH_NOT_CONFIGURED', 'El programador de cobros no está configurado.', 503);
    }
    if (!authorized(req.headers.get('authorization'), expected)) {
      return fail('UNAUTHORIZED', 'Credencial de programador no válida.', 401);
    }

    const report = await chargeDueSubscriptions();
    return ok(report);
  } catch (error) {
    return handleError(error);
  }
}

function authorized(header: string | null, expected: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const provided = Buffer.from(header.slice(7));
  const target = Buffer.from(expected);
  if (provided.length !== target.length) return false;
  return timingSafeEqual(provided, target);
}
