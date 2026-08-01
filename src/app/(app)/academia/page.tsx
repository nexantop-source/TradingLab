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
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Academia</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
          Cada lección combina explicación, ejemplo, pregunta, ejercicio y evaluación. No se avanza por ver
          contenido: se avanza demostrando comprensión.
        </p>
      </header>

      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-4 text-[var(--color-blue)]" aria-hidden="true" />
            <p className="text-[13px] font-semibold">Tu progreso general</p>
          </div>
          <p className="num text-[13px] text-[var(--color-muted)]">
            {totalCompleted} de {totalLessons} lecciones
          </p>
        </div>
        <Progress className="mt-3" value={totalCompleted} max={Math.max(totalLessons, 1)} label="Progreso general" />
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {enriched.map((t) => (
          <Link
            key={t.id}
            href={`/academia/${t.slug}`}
            className="group flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-blue)]"
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

      <AdSlot code="academy-footer" page="academy" />
    </div>
  );
}
