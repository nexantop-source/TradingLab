import { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fromJson, toJson } from '@/lib/json';
import { quizAttemptSchema } from '@/lib/validation';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';
import { awardXp } from '@/lib/gamification';
import { XP_REWARDS } from '@/content/gamification';
import type { QuizQuestion } from '@tl/types';

/**
 * Corrección de cuestionarios.
 *
 * La corrección ocurre siempre en el servidor: las respuestas correctas nunca
 * se envían al navegador antes de responder.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const input = quizAttemptSchema.parse(await req.json());

    const lesson = await db.lesson.findUnique({
      where: { slug: input.lessonSlug },
      include: { quiz: true },
    });
    if (!lesson?.quiz) return fail('NOT_FOUND', 'Esta lección no tiene cuestionario.', 404);

    const questions = fromJson<QuizQuestion[]>(lesson.quiz.questions, []);
    if (input.answers.length !== questions.length) {
      return fail('INCOMPLETE', 'Responde todas las preguntas antes de enviar el cuestionario.', 400);
    }

    let correct = 0;
    const detail = questions.map((q, i) => {
      const chosen = input.answers[i];
      const isCorrect = chosen === q.correctIndex;
      if (isCorrect) correct++;
      return {
        id: q.id,
        prompt: q.prompt,
        chosenIndex: chosen,
        correctIndex: q.correctIndex,
        correct: isCorrect,
        explanation: q.explanation,
      };
    });

    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= lesson.quiz.passingScore;

    const previousBest = await db.quizAttempt.findFirst({
      where: { userId: user.id, quizId: lesson.quiz.id },
      orderBy: { score: 'desc' },
      select: { score: true },
    });

    await db.quizAttempt.create({
      data: {
        quizId: lesson.quiz.id,
        userId: user.id,
        answers: toJson(input.answers),
        score,
        passed,
      },
    });

    if (passed && (previousBest?.score ?? 0) < lesson.quiz.passingScore) {
      await awardXp(user.id, score === 100 ? XP_REWARDS.QUIZ_PERFECT : XP_REWARDS.QUIZ_PASSED, 'superar un cuestionario');
      await track(ANALYTICS_EVENTS.QUIZ_PASSED, { lessonSlug: lesson.slug, score }, { userId: user.id });
    } else {
      await track(ANALYTICS_EVENTS.QUIZ_ATTEMPTED, { lessonSlug: lesson.slug, score, passed }, { userId: user.id });
    }

    return ok({
      score,
      passed,
      passingScore: lesson.quiz.passingScore,
      correct,
      total: questions.length,
      detail,
      improvement: previousBest ? score - previousBest.score : null,
    });
  } catch (error) {
    return handleError(error);
  }
}
