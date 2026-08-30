import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import { LessonView } from './LessonView';
import { marketData } from '@tl/market-data';
import { getSymbol } from '@tl/market-data/symbols';
import type { Candle, LessonBlock, QuizQuestion, Timeframe } from '@tl/types';
import { planAtLeast } from '@tl/types/plans';
import type { PlanId } from '@tl/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lesson = await db.lesson.findUnique({ where: { slug }, select: { title: true, summary: true } });
  return { title: lesson?.title ?? 'Lección', description: lesson?.summary };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const { slug } = await params;

  const lesson = await db.lesson.findUnique({
    where: { slug },
    include: {
      quiz: true,
      module: { include: { course: { include: { track: true } } } },
    },
  });
  if (!lesson) notFound();

  if (!planAtLeast(auth.user.plan, lesson.minPlan as PlanId)) redirect('/precios');

  const blocks = fromJson<LessonBlock[]>(lesson.blocks, []);

  // Precarga de las series necesarias para los bloques de tipo `chart`.
  const provider = marketData();
  const chartData: Record<string, { candles: Candle[]; precision: number; name: string }> = {};
  for (const block of blocks) {
    if (block.type !== 'chart' || !block.symbol) continue;
    const meta = getSymbol(block.symbol);
    if (!meta) continue;
    const series = await provider.getCandles({
      symbol: meta.symbol,
      timeframe: (block.timeframe ?? '1h') as Timeframe,
      limit: 120,
    });
    chartData[`${block.symbol}:${block.timeframe ?? '1h'}`] = {
      candles: series.candles,
      precision: meta.precision,
      name: meta.name,
    };
  }

  const [progress, bestAttempt, siblings, simulationCount] = await Promise.all([
    db.userProgress.findUnique({
      where: { userId_lessonId: { userId: auth.user.id, lessonId: lesson.id } },
    }),
    lesson.quiz
      ? db.quizAttempt.findFirst({
          where: { userId: auth.user.id, quizId: lesson.quiz.id },
          orderBy: { score: 'desc' },
        })
      : Promise.resolve(null),
    db.lesson.findMany({
      where: { moduleId: lesson.moduleId },
      orderBy: { position: 'asc' },
      select: { slug: true, title: true, position: true },
    }),
    db.simulation.count({ where: { userId: auth.user.id } }),
  ]);

  const index = siblings.findIndex((s) => s.slug === lesson.slug);

  return (
    <LessonView
      lesson={{
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        estimatedMinutes: lesson.estimatedMinutes,
        requiresSimulation: lesson.requiresSimulation,
        topic: lesson.topic,
        blocks,
      }}
      trackTitle={lesson.module.course.track.title}
      trackSlug={lesson.module.course.track.slug}
      moduleTitle={lesson.module.title}
      quiz={
        lesson.quiz
          ? {
              passingScore: lesson.quiz.passingScore,
              questions: fromJson<QuizQuestion[]>(lesson.quiz.questions, []).map((q) => ({
                id: q.id,
                prompt: q.prompt,
                options: q.options,
              })),
            }
          : null
      }
      bestScore={bestAttempt?.score ?? null}
      quizPassed={bestAttempt?.passed ?? false}
      completed={progress?.status === 'COMPLETED'}
      hasSimulations={simulationCount > 0}
      chartData={chartData}
      previous={index > 0 ? siblings[index - 1] : null}
      next={index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null}
      plan={auth.user.plan}
    />
  );
}
