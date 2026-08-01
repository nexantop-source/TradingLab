import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { toJson } from '@/lib/json';
import { onboardingSchema } from '@/lib/validation';
import { ASSESSMENT, classify } from '@/content/assessment';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';
import { ensureDemoAccount } from '@/lib/demo-account';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const input = onboardingSchema.parse(await req.json());

    // La puntuación se calcula en el servidor a partir de los índices
    // elegidos: el cliente nunca envía la nota.
    let score = 0;
    ASSESSMENT.forEach((question, i) => {
      const chosen = input.assessmentAnswers[i];
      const option = question.options[chosen];
      if (option) score += option.points;
    });

    const classification = classify(score);

    await db.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        experienceLevel: classification.level,
        marketInterests: toJson(input.marketInterests),
        educationalGoal: input.educationalGoal,
        weeklyAvailability: input.weeklyAvailability,
        riskKnowledgeScore: score,
      },
      update: {
        experienceLevel: classification.level,
        marketInterests: toJson(input.marketInterests),
        educationalGoal: input.educationalGoal,
        weeklyAvailability: input.weeklyAvailability,
        riskKnowledgeScore: score,
      },
    });

    await db.user.update({ where: { id: user.id }, data: { onboardingCompleted: true } });

    // La cuenta DEMO se crea en el registro; esto la garantiza si el usuario
    // llegó por otra vía (por ejemplo, una migración de datos).
    const account = await ensureDemoAccount(user.id);

    await db.notification.create({
      data: {
        userId: user.id,
        kind: 'INFO',
        title: 'Tu cuenta DEMO está lista',
        body: 'Has recibido USD 10.000 virtuales. No es dinero real, no puede retirarse y existe para que puedas practicar sin consecuencias económicas.',
        href: '/panel',
      },
    });

    await track(
      ANALYTICS_EVENTS.ASSESSMENT_COMPLETED,
      { score, level: classification.level, goal: input.educationalGoal },
      { userId: user.id },
    );
    await track(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, { level: classification.level }, { userId: user.id });

    return ok({
      score,
      classification,
      demoBalanceCents: account.balanceCents,
      rationales: ASSESSMENT.map((q, i) => ({
        prompt: q.prompt,
        chosen: q.options[input.assessmentAnswers[i]]?.label ?? '—',
        points: q.options[input.assessmentAnswers[i]]?.points ?? 0,
        rationale: q.rationale,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
