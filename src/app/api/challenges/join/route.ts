import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { refreshChallengeProgress } from '@/lib/gamification';
import { planAtLeast } from '@tl/types/plans';
import type { PlanId } from '@tl/types';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';

const bodySchema = z.object({ challengeId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const { challengeId } = bodySchema.parse(await req.json());

    const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) return fail('NOT_FOUND', 'No se ha encontrado el reto.', 404);
    if (challenge.endsAt < new Date()) return fail('CHALLENGE_ENDED', 'Este reto ya ha finalizado.', 400);
    if (!planAtLeast(user.plan, challenge.minPlan as PlanId)) {
      return fail('PLAN_REQUIRED', `Este reto está disponible a partir del plan ${challenge.minPlan}.`, 403);
    }

    await db.challengeEntry.upsert({
      where: { challengeId_userId: { challengeId, userId: user.id } },
      create: { challengeId, userId: user.id },
      update: {},
    });

    await refreshChallengeProgress(user.id);
    await track(ANALYTICS_EVENTS.CHALLENGE_JOINED, { challengeId, metric: challenge.metric }, { userId: user.id });

    return ok({ joined: true });
  } catch (error) {
    return handleError(error);
  }
}
