import 'server-only';
import { db } from './db';

const USER_SUMMARY = { user: { select: { email: true, name: true } } } as const;

/**
 * Garantiza que una alerta HIGH abierta nunca quede fuera por el límite de la
 * pantalla. Primero toma los casos críticos y solo después completa el cupo.
 */
export async function prioritizedSupportTickets(limit = 60) {
  const highOpen = await db.supportTicket.findMany({
    where: { priority: 'HIGH', status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: USER_SUMMARY,
  });

  const remaining = Math.max(0, limit - highOpen.length);
  if (remaining === 0) return highOpen;

  const rest = await db.supportTicket.findMany({
    where: highOpen.length > 0 ? { id: { notIn: highOpen.map((ticket) => ticket.id) } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: remaining,
    include: USER_SUMMARY,
  });
  return [...highOpen, ...rest];
}
