import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { refreshChallengeProgress } from '@/lib/gamification';
import { levelFromXp } from '@/content/gamification';
import { Badge, Card, Progress, Callout } from '@tl/ui';
import { AdSlot } from '@/components/AdSlot';
import { JoinButton } from './JoinButton';
import { planAtLeast } from '@tl/types/plans';
import type { PlanId } from '@tl/types';
import { Trophy, Award } from 'lucide-react';

export const metadata: Metadata = { title: 'Retos e insignias' };
export const dynamic = 'force-dynamic';

export default async function ChallengesPage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  await refreshChallengeProgress(auth.user.id);

  const [challenges, entries, badges, earned, user] = await Promise.all([
    db.challenge.findMany({ where: { endsAt: { gte: new Date() } }, orderBy: { endsAt: 'asc' } }),
    db.challengeEntry.findMany({ where: { userId: auth.user.id } }),
    db.badge.findMany({ orderBy: { category: 'asc' } }),
    db.userBadge.findMany({ where: { userId: auth.user.id }, select: { badgeId: true, awardedAt: true } }),
    db.user.findUnique({ where: { id: auth.user.id }, select: { xp: true, streakDays: true } }),
  ]);

  const entryByChallenge = new Map(entries.map((e) => [e.challengeId, e]));
  const earnedIds = new Map(earned.map((e) => [e.badgeId, e.awardedAt]));
  const level = levelFromXp(user?.xp ?? 0);

  const CATEGORY_LABEL: Record<string, string> = {
    DISCIPLINA: 'Disciplina',
    APRENDIZAJE: 'Aprendizaje',
    CONSISTENCIA: 'Consistencia',
    ANALISIS: 'Análisis',
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Retos e insignias</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
          Ninguna recompensa depende del beneficio virtual. Se premian el uso del stop loss, la contención del
          riesgo, la constancia y la calidad del diario.
        </p>
      </header>

      <Callout tone="info" title="Sin mecánicas de azar">
        No hay cajas de recompensa, giros ni sorteos. Todo lo que puedes conseguir aquí depende de una conducta
        concreta y medible, y sabes de antemano cuál es.
      </Callout>

      {/* Nivel */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">Tu nivel</p>
            <p className="num mt-1 text-3xl font-semibold tracking-tight">{level.level}</p>
          </div>
          <div className="min-w-48 flex-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-[var(--color-muted)]">Experiencia</span>
              <span className="num text-[12px] text-[var(--color-muted)]">
                {user?.xp ?? 0}
                {level.next ? ` / ${level.next}` : ''} XP
              </span>
            </div>
            <Progress
              className="mt-2"
              tone="gold"
              value={level.next ? (user?.xp ?? 0) - level.current : 1}
              max={level.next ? level.next - level.current : 1}
              label="Progreso de nivel"
            />
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">Racha</p>
            <p className="num mt-1 text-xl font-semibold">{user?.streakDays ?? 0} d</p>
          </div>
        </div>
      </Card>

      {/* Retos */}
      <section>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Trophy className="size-4 text-[var(--color-gold)]" aria-hidden="true" />
          Retos activos
        </h2>
        <ul className="mt-3 space-y-3">
          {challenges.map((c) => {
            const entry = entryByChallenge.get(c.id);
            const available = planAtLeast(auth.user.plan, c.minPlan as PlanId);
            return (
              <li key={c.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-semibold">{c.title}</h3>
                        {c.visibility === 'PRIVATE' && <Badge tone="violet">Privado</Badge>}
                        {!available && <Badge tone="gold">Plan {c.minPlan}</Badge>}
                        {entry?.completedAt && <Badge tone="positive">Completado</Badge>}
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-muted)]">
                        {c.description}
                      </p>
                      <p className="num mt-2 text-[11px] text-[var(--color-subtle)]">
                        Métrica: {c.metric} · objetivo {c.target} · recompensa {c.xpReward} XP
                      </p>
                    </div>
                    {available && (
                      <JoinButton challengeId={c.id} joined={Boolean(entry)} completed={Boolean(entry?.completedAt)} />
                    )}
                  </div>

                  {entry && (
                    <div className="mt-4">
                      <Progress
                        value={entry.progress}
                        max={c.target}
                        tone={entry.completedAt ? 'positive' : 'violet'}
                        label={c.title}
                      />
                      <p className="num mt-1.5 text-[11px] text-[var(--color-muted)]">
                        Progreso: {entry.progress.toFixed(1)} de {c.target}
                      </p>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <AdSlot code="challenge-sponsor" page="challenges" plan={auth.user.plan} />

      {/* Insignias */}
      <section>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Award className="size-4 text-[var(--color-violet)]" aria-hidden="true" />
          Insignias
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          {earned.length} de {badges.length} conseguidas.
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((b) => {
            const awardedAt = earnedIds.get(b.id);
            return (
              <Card
                key={b.id}
                className={`p-4 ${awardedAt ? '' : 'opacity-55'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={awardedAt ? 'positive' : 'neutral'}>
                    {CATEGORY_LABEL[b.category] ?? b.category}
                  </Badge>
                  {awardedAt && <span className="text-[10px] text-[var(--color-subtle)]">Conseguida</span>}
                </div>
                <p className="mt-2.5 text-[13px] font-semibold">{b.name}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">{b.description}</p>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
