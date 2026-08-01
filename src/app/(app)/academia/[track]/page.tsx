import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Check, Lock, PlayCircle } from 'lucide-react';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Badge, Card, Progress, Button } from '@tl/ui';
import { planAtLeast } from '@tl/types/plans';
import type { PlanId } from '@tl/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string }>;
}): Promise<Metadata> {
  const { track } = await params;
  const row = await db.track.findUnique({ where: { slug: track }, select: { title: true, summary: true } });
  return { title: row?.title ?? 'Ruta educativa', description: row?.summary };
}

export default async function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const { track: slug } = await params;

  const track = await db.track.findUnique({
    where: { slug },
    include: {
      courses: {
        orderBy: { position: 'asc' },
        include: {
          modules: {
            orderBy: { position: 'asc' },
            include: {
              lessons: {
                orderBy: { position: 'asc' },
                include: { quiz: { select: { id: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!track) notFound();

  const progress = await db.userProgress.findMany({
    where: { userId: auth.user.id },
    select: { lessonId: true, status: true },
  });
  const statusByLesson = new Map(progress.map((p) => [p.lessonId, p.status]));

  const allLessons = track.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons));
  const completed = allLessons.filter((l) => statusByLesson.get(l.id) === 'COMPLETED').length;
  const nextLesson = allLessons.find((l) => statusByLesson.get(l.id) !== 'COMPLETED');

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <nav aria-label="Ruta de navegación" className="text-[12px] text-[var(--color-muted)]">
        <Link href="/academia" className="hover:text-[var(--color-text)]">
          Academia
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-[var(--color-text)]">{track.title}</span>
      </nav>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={track.level === 'BASICO' ? 'positive' : track.level === 'INTERMEDIO' ? 'blue' : 'violet'}>
            {track.level === 'BASICO' ? 'Básico' : track.level === 'INTERMEDIO' ? 'Intermedio' : 'Avanzado'}
          </Badge>
          <span className="num text-[11px] text-[var(--color-subtle)]">
            {allLessons.length} lecciones
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">{track.title}</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">{track.summary}</p>
      </header>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">Tu progreso en esta ruta</p>
            <Progress
              className="mt-2.5"
              value={completed}
              max={Math.max(allLessons.length, 1)}
              tone={completed === allLessons.length ? 'positive' : 'blue'}
              label="Progreso de la ruta"
            />
            <p className="num mt-2 text-[11px] text-[var(--color-muted)]">
              {completed} de {allLessons.length} lecciones completadas
            </p>
          </div>
          {nextLesson && (
            <Link href={`/academia/leccion/${nextLesson.slug}`}>
              <Button size="sm">
                <PlayCircle className="size-4" aria-hidden="true" />
                {completed === 0 ? 'Empezar' : 'Continuar'}
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {track.courses.map((course) => (
        <section key={course.id}>
          <h2 className="text-[15px] font-semibold tracking-tight">{course.title}</h2>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">{course.summary}</p>

          <div className="mt-4 space-y-4">
            {course.modules.map((mod) => (
              <Card key={mod.id}>
                <div className="border-b border-[var(--color-border)] px-4 py-3">
                  <h3 className="text-[13px] font-semibold">{mod.title}</h3>
                </div>
                <ul className="divide-y divide-[var(--color-border)]">
                  {mod.lessons.map((lesson, i) => {
                    const status = statusByLesson.get(lesson.id);
                    const locked = !planAtLeast(auth.user.plan, lesson.minPlan as PlanId);
                    return (
                      <li key={lesson.id}>
                        <Link
                          href={locked ? '/precios' : `/academia/leccion/${lesson.slug}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-overlay)]"
                        >
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                              status === 'COMPLETED'
                                ? 'bg-[var(--color-positive-soft)] text-[var(--color-positive)]'
                                : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                            }`}
                          >
                            {status === 'COMPLETED' ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium">{lesson.title}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-[var(--color-muted)]">
                              {lesson.summary}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {lesson.requiresSimulation && <Badge tone="blue">Práctica</Badge>}
                            {lesson.quiz && <Badge tone="neutral">Cuestionario</Badge>}
                            {locked && <Lock className="size-3.5 text-[var(--color-gold)]" aria-label="Requiere otro plan" />}
                            <span className="num text-[10px] text-[var(--color-subtle)]">
                              {lesson.estimatedMinutes} min
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
