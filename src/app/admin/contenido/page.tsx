import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { Badge, Card, Callout } from '@tl/ui';

export const metadata: Metadata = { title: 'Contenido' };
export const dynamic = 'force-dynamic';

export default async function AdminContentPage() {
  const auth = await getAuth();
  if (!auth || !can(auth.user.role, 'content:read')) redirect('/panel');

  const [tracks, lessons, quizzes, glossary, news, certificates, attempts] = await Promise.all([
    db.track.findMany({
      orderBy: { position: 'asc' },
      include: {
        courses: { include: { modules: { include: { lessons: { select: { id: true, published: true } } } } } },
      },
    }),
    db.lesson.count(),
    db.quiz.count(),
    db.glossaryTerm.count(),
    db.newsArticleRecord.count(),
    db.certificate.count(),
    db.quizAttempt.groupBy({ by: ['quizId'], _avg: { score: true }, _count: { _all: true } }),
  ]);

  // Cuestionarios con puntuación media baja: señal de que la lección no explica bien.
  const quizIds = attempts.filter((a) => (a._avg.score ?? 100) < 60 && a._count._all >= 3);
  const weakQuizzes = quizIds.length
    ? await db.quiz.findMany({
        where: { id: { in: quizIds.map((q) => q.quizId) } },
        include: { lesson: { select: { title: true, slug: true } } },
      })
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Contenido</h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[var(--color-muted)]">
          Estructura de la academia, glosario y artículos. El contenido inicial vive en{' '}
          <span className="num">src/content/academy.ts</span> y se carga con la semilla; a partir de ahí se edita
          sobre estas mismas tablas.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Rutas" value={String(tracks.length)} />
        <Stat label="Lecciones" value={String(lessons)} />
        <Stat label="Cuestionarios" value={String(quizzes)} />
        <Stat label="Términos" value={String(glossary)} />
        <Stat label="Artículos" value={String(news)} />
        <Stat label="Certificados" value={String(certificates)} />
      </div>

      {weakQuizzes.length > 0 && (
        <Callout tone="warning" title="Cuestionarios con puntuación media baja">
          Estas lecciones podrían no estar explicando con claridad el concepto que evalúan:
          {weakQuizzes.map((q) => (
            <span key={q.id} className="block">
              · {q.lesson.title}
            </span>
          ))}
        </Callout>
      )}

      <Card className="overflow-x-auto">
        <div className="border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">Rutas educativas</h2>
        </div>
        <table className="w-full min-w-[40rem] text-[12px]">
          <caption className="sr-only">Rutas educativas publicadas</caption>
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Ruta</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Nivel</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Tema</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Lecciones</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Plan mínimo</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t) => {
              const count = t.courses.reduce(
                (a, c) => a + c.modules.reduce((b, m) => b + m.lessons.length, 0),
                0,
              );
              return (
                <tr key={t.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="block font-medium">{t.title}</span>
                    <span className="num block text-[10px] text-[var(--color-subtle)]">{t.slug}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={t.level === 'BASICO' ? 'positive' : t.level === 'INTERMEDIO' ? 'blue' : 'violet'}>
                      {t.level}
                    </Badge>
                  </td>
                  <td className="num px-4 py-2.5 text-[var(--color-muted)]">{t.topic}</td>
                  <td className="num px-4 py-2.5 text-right">{count}</td>
                  <td className="num px-4 py-2.5 text-[var(--color-muted)]">{t.minPlan}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={t.published ? 'positive' : 'neutral'}>
                      {t.published ? 'Publicada' : 'Borrador'}
                    </Badge>
                    {t.sponsorId && <Badge tone="gold" className="ml-1.5">Patrocinada</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Regla editorial sobre patrocinios</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
          Un patrocinador puede asociar su marca a una ruta mediante logotipo y un mensaje institucional aprobado
          editorialmente. En ningún caso puede intervenir en el contenido de las lecciones, en las evaluaciones ni
          en las recomendaciones formativas. Esta restricción es contractual y se refleja en la política
          publicitaria pública.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">{label}</p>
      <p className="num mt-1.5 text-xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}
