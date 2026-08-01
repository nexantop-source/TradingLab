import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { supportTicketSchema } from '@/lib/validation';
import { enforce, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    await enforce(`support:${user.id}`, { limit: 5, windowSeconds: 3600 });

    const input = supportTicketSchema.parse(await req.json());

    const ticket = await db.supportTicket.create({
      data: {
        userId: user.id,
        subject: input.subject,
        body: input.body,
        category: input.category,
        // Los avisos de fraude y los usuarios Premium entran con prioridad alta.
        priority: input.category === 'FRAUDE' || user.plan === 'PREMIUM' ? 'HIGH' : 'NORMAL',
      },
    });

    return ok({ id: ticket.id }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
