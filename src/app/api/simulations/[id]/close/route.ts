import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { closeSimulationById } from '@/lib/simulation-service';
import { z } from 'zod';

const bodySchema = z.object({
  fraction: z.number().min(0.01).max(1).default(1),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth();
    const { id } = await ctx.params;

    const raw = await req.json().catch(() => ({}));
    const { fraction } = bodySchema.parse(raw);

    const result = await closeSimulationById({
      userId: user.id,
      simulationId: id,
      fraction,
      reason: fraction < 1 ? 'PARTIAL' : 'MANUAL',
    });

    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}
