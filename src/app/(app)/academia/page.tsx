import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Badge, Card, Progress } from '@tl/ui';
import { AdSlot } from '@/components/AdSlot';
import { planAtLeast } from '@tl/types/plans';
import type { PlanId } from '@tl/types';

export const metadata: Metadata = { title: 'Academia' };
export const dynamic = 'force-dynamic';

const LEVEL_LABEL: Record<string, string> = {
  BASICO: 'Básico',
  INTERMEDIO: 'Intermedio',
  AVANZADO: 'Avanzado',
};

export default async function AcademyPage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const [tracks, progress] = await Promise.all([
    db.track.findMany({
      where: { published: true },
      orderBy: { position: 'asc' },
      include: {
        courses: {
          include: { modules: { include: { lessons: { select: { id: true, estimatedMinutes: true } } } } },
        },
      },
    }),
    db.userProgress.findMany({
      where: { userId: auth.user.id, status: 'COMPLETED' },
      select: { lessonId: true },
    }),
  ]);

  const done = new Set(progress.map((p) => p.lessonId));

  const enriched = tracks.map((t) => {
    const lessons = t.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons));
    const completed = lessons.filter((l) => done.has(l.id)).length;
    return {
      ...t,
      totalLessons: lessons.length,
      completed,
      minutes: lessons.reduce((a, l) => a + l.estimatedMinutes, 0),
      available: planAtLeast(auth.user.plan, t.minPlan as PlanId),
    };
  });

  const totalCompleted = enriched.reduce((a, t) => a + t.completed, 0);
  const totalLessons = enriched.reduce((a, t) => a + t.totalLessons, 0);

  return (
    <div className="app-content-page mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <p className="app-page-kicker">Aprender</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Tu ruta de aprendizaje</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
          Cada lección combina explicación, ejemplo, pregunta, ejercicio y evaluación. No avanzas por consumir contenido: avanzas demostrando comprensión.
        </p>
      </header>

      <section className="app-academy-hero">
        <div className="relative z-10 max-w-xl">
          <div className="flex items-center gap-2 text-[var(--color-blue)]">
            <GraduationCap className="size-4" aria-hidden="true" />
            <p className="app-page-kicker text-[var(--color-blue)]">Progreso general</p>
          </div>
          <p className="num mt-4 text-4xl font-semibold tracking-[-0.06em]">{totalCompleted}<span className="text-lg text-[var(--color-subtle)]"> / {totalLessons}</span></p>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">lecciones completadas</p>
          <Progress className="mt-5 max-w-md" value={totalCompleted} max={Math.max(totalLessons, 1)} label="Progreso general" />
        </div>
        <div className="app-academy-orbit" aria-hidden="true">
          <span className="app-academy-orbit-line app-academy-orbit-line-a" />
          <span className="app-academy-orbit-line app-academy-orbit-line-b" />
          <span className="app-academy-orbit-core"><GraduationCap className="size-5" /></span>
          <span className="app-academy-orbit-label">Aprender · aplicar · revisar</span>
        </div>
      </section>

      <div className="app-course-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {enriched.map((t) => (
          <Link
            key={t.id}
            href={`/academia/${t.slug}`}
            className="app-course-card group flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-blue)]"
          >
            <div className="flex items-center justify-between gap-2">
              <Badge
                tone={t.level === 'BASICO' ? 'positive' : t.level === 'INTERMEDIO' ? 'blue' : 'violet'}
              >
                {LEVEL_LABEL[t.level] ?? t.level}
              </Badge>
              {!t.available && <Badge tone="gold">Plan {t.minPlan}</Badge>}
            </div>

            <h2 className="mt-3.5 text-[15px] font-semibold tracking-tight transition-colors group-hover:text-[var(--color-blue)]">
              {t.title}
            </h2>
            <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-[var(--color-muted)]">{t.summary}</p>

            <div className="mt-4">
              <Progress
                value={t.completed}
                max={Math.max(t.totalLessons, 1)}
                tone={t.completed === t.totalLessons && t.totalLessons > 0 ? 'positive' : 'blue'}
                label={`Progreso de ${t.title}`}
              />
              <p className="num mt-2 text-[10px] text-[var(--color-subtle)]">
                {t.completed}/{t.totalLessons} lecciones · {t.minutes} min
              </p>
            </div>
          </Link>
        ))}
      </div>

      <AdSlot code="academy-footer" page="academy" plan={auth.user.plan} />
    </div>
  );
}
