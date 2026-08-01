import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail, handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';
import { awardXp, evaluateBadges } from '@/lib/gamification';
import { XP_REWARDS } from '@/content/gamification';
import { planAtLeast } from '@tl/types/plans';
import type { PlanId } from '@tl/types';

const bodySchema = z.object({
  lessonSlug: z.string().min(1).max(120),
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const input = bodySchema.parse(await req.json());

    const lesson = await db.lesson.findUnique({
      where: { slug: input.lessonSlug },
      include: { quiz: { select: { id: true } } },
    });
    if (!lesson) return fail('NOT_FOUND', 'No se ha encontrado la lección.', 404);

    if (!planAtLeast(user.plan, lesson.minPlan as PlanId)) {
      return fail('PLAN_REQUIRED', `Esta lección está disponible a partir del plan ${lesson.minPlan}.`, 403);
    }

    // Una lección no se da por completada solo por abrirla: si tiene
    // cuestionario, hay que haberlo superado; si exige simulación, hay que
    // haber creado al menos una. Es el criterio pedagógico del producto.
    if (input.status === 'COMPLETED') {
      if (lesson.quiz) {
        const passed = await db.quizAttempt.findFirst({
          where: { userId: user.id, quizId: lesson.quiz.id, passed: true },
        });
        if (!passed) {
          return fail(
            'QUIZ_REQUIRED',
            'Para completar esta lección debes superar antes su cuestionario.',
            400,
          );
        }
      }
      if (lesson.requiresSimulation) {
        const simCount = await db.simulation.count({ where: { userId: user.id } });
        if (simCount === 0) {
          return fail(
            'SIMULATION_REQUIRED',
            'Esta lección incluye un ejercicio práctico: crea al menos una simulación antes de darla por completada.',
            400,
          );
        }
      }
    }

    const existing = await db.userProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
    });

    await db.userProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
      create: {
        userId: user.id,
        lessonId: lesson.id,
        status: input.status,
        completedAt: input.status === 'COMPLETED' ? new Date() : null,
      },
      update: {
        status: input.status,
        completedAt: input.status === 'COMPLETED' ? new Date() : null,
      },
    });

    const firstCompletion = input.status === 'COMPLETED' && existing?.status !== 'COMPLETED';
    if (firstCompletion) {
      await awardXp(user.id, XP_REWARDS.LESSON_COMPLETED, 'completar una lección');
      const total = await db.userProgress.count({ where: { userId: user.id, status: 'COMPLETED' } });
      await track(
        total === 1 ? ANALYTICS_EVENTS.FIRST_LESSON_COMPLETED : ANALYTICS_EVENTS.LESSON_COMPLETED,
        { lessonSlug: lesson.slug, topic: lesson.topic },
        { userId: user.id },
      );
    } else if (input.status === 'IN_PROGRESS' && !existing) {
      await track(ANALYTICS_EVENTS.LESSON_STARTED, { lessonSlug: lesson.slug }, { userId: user.id });
    }

    const badges = firstCompletion ? await evaluateBadges(user.id) : [];

    return ok({ lessonSlug: lesson.slug, status: input.status, badgesAwarded: badges });
  } catch (error) {
    return handleError(error);
  }
}
