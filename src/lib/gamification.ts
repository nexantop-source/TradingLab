import 'server-only';
import { db } from './db';
import { levelFromXp } from '@/content/gamification';
import { computeStats, type SimulationSample } from '@tl/simulation-engine';
import { INITIAL_DEMO_BALANCE_CENTS } from '@tl/types';

/**
 * Motor de gamificación.
 *
 * Regla de diseño: ninguna recompensa depende del beneficio virtual. Se premia
 * el uso de stop loss, la relación riesgo-beneficio, la constancia, la calidad
 * del diario y el avance educativo.
 */

export async function awardXp(userId: string, amount: number, reason: string): Promise<{ xp: number; level: number; leveledUp: boolean }> {
  const before = await db.user.findUnique({ where: { id: userId }, select: { xp: true, level: true } });
  if (!before) return { xp: 0, level: 1, leveledUp: false };

  const xp = before.xp + amount;
  const { level } = levelFromXp(xp);
  const leveledUp = level > before.level;

  await db.user.update({ where: { id: userId }, data: { xp, level } });

  if (leveledUp) {
    await db.notification.create({
      data: {
        userId,
        kind: 'SUCCESS',
        title: `Has alcanzado el nivel ${level}`,
        body: `Tu progreso se debe a ${reason.toLowerCase()} y al resto de tu actividad educativa. El nivel refleja aprendizaje y disciplina, no rentabilidad virtual.`,
        href: '/perfil',
      },
    });
  }

  return { xp, level, leveledUp };
}

/**
 * Evalúa las insignias del usuario y otorga las nuevas.
 * Devuelve las concedidas en esta pasada.
 */
export async function evaluateBadges(userId: string): Promise<string[]> {
  const [user, badges, owned, sims, lessonsDone, tracksDone, quizzes, reviews] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { streakDays: true } }),
    db.badge.findMany(),
    db.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    db.simulation.findMany({
      where: { userId },
      orderBy: { openedAt: 'desc' },
      take: 300,
      include: { journalEntry: { select: { id: true } } },
    }),
    db.userProgress.count({ where: { userId, status: 'COMPLETED' } }),
    countCompletedTracks(userId),
    db.quizAttempt.count({ where: { userId, score: { gte: 90 } } }),
    db.aIAnalysis.count({ where: { userId, kind: 'POST_TRADE' } }),
  ]);

  if (!user) return [];

  const ownedIds = new Set(owned.map((o) => o.badgeId));

  const samples: SimulationSample[] = sims.map((s, i) => {
    const previous = sims[i + 1];
    return {
      id: s.id,
      symbol: s.symbol,
      assetClass: s.assetClass,
      mode: s.mode,
      direction: s.direction,
      outcome: s.outcome as SimulationSample['outcome'],
      pnlCents: s.pnlCents,
      stakeCents: s.stakeCents,
      leverage: s.leverage,
      hasStopLoss: s.stopLoss != null,
      hasTakeProfit: s.takeProfit != null,
      riskReward:
        s.stopLoss != null && s.takeProfit != null
          ? Math.abs(s.takeProfit - s.entryPrice) / Math.abs(s.entryPrice - s.stopLoss)
          : null,
      rationaleLength: s.rationale.length,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      hasJournalEntry: Boolean(s.journalEntry),
      minutesSincePrevious: previous
        ? Math.round((s.openedAt.getTime() - previous.openedAt.getTime()) / 60000)
        : null,
      strategyTag: s.strategyTag,
    };
  });

  const stats = computeStats(samples, INITIAL_DEMO_BALANCE_CENTS);

  // Racha de simulaciones consecutivas con stop loss, desde la más reciente.
  let stopLossStreak = 0;
  for (const s of samples) {
    if (s.hasStopLoss) stopLossStreak++;
    else break;
  }

  const context: Record<string, number> = {
    LESSONS_COMPLETED: lessonsDone,
    SIMULATIONS: stats.totalSimulations,
    STOP_LOSS_STREAK: stopLossStreak,
    AVG_RISK: stats.averageRiskPercent,
    AVG_RR: stats.averageRiskReward ?? 0,
    JOURNAL_COVERAGE: stats.journalCoveragePercent,
    IMPULSIVE: stats.impulsiveCount,
    STREAK: user.streakDays,
    TRACKS_COMPLETED: tracksDone,
    QUIZ_HIGH_SCORES: quizzes,
    POST_TRADE_REVIEWS: reviews,
    PLAN_RESPECTED: stopLossStreak,
  };

  const awarded: string[] = [];
  for (const badge of badges) {
    if (ownedIds.has(badge.id)) continue;
    if (!evaluateCriterion(badge.criterion, context)) continue;

    await db.userBadge.create({ data: { userId, badgeId: badge.id } });
    await db.notification.create({
      data: {
        userId,
        kind: 'SUCCESS',
        title: `Insignia conseguida: ${badge.name}`,
        body: badge.description,
        href: '/perfil',
      },
    });
    awarded.push(badge.slug);
  }

  return awarded;
}

/**
 * Evaluador de criterios. Acepta expresiones simples del tipo
 * `CLAVE>=valor` unidas por `&&`. Deliberadamente limitado: no se evalúa
 * código arbitrario procedente de la base de datos.
 */
function evaluateCriterion(criterion: string, context: Record<string, number>): boolean {
  const clauses = criterion.split('&&').map((c) => c.trim());
  return clauses.every((clause) => {
    const match = clause.match(/^([A-Z_]+)(>=|<=|==|>|<)(-?\d+(?:\.\d+)?)$/);
    if (!match) return false;
    const [, key, op, valueRaw] = match;
    const actual = context[key];
    if (actual == null) return false;
    const expected = Number(valueRaw);
    switch (op) {
      case '>=':
        return actual >= expected;
      case '<=':
        return actual <= expected;
      case '==':
        return actual === expected;
      case '>':
        return actual > expected;
      case '<':
        return actual < expected;
      default:
        return false;
    }
  });
}

async function countCompletedTracks(userId: string): Promise<number> {
  const tracks = await db.track.findMany({
    include: { courses: { include: { modules: { include: { lessons: { select: { id: true } } } } } } },
  });
  const completed = await db.userProgress.findMany({
    where: { userId, status: 'COMPLETED' },
    select: { lessonId: true },
  });
  const done = new Set(completed.map((c) => c.lessonId));

  let count = 0;
  for (const t of tracks) {
    const lessonIds = t.courses.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)));
    if (lessonIds.length > 0 && lessonIds.every((id) => done.has(id))) count++;
  }
  return count;
}

/** Progreso de los retos en los que participa el usuario. */
export async function refreshChallengeProgress(userId: string): Promise<void> {
  const entries = await db.challengeEntry.findMany({
    where: { userId, completedAt: null },
    include: { challenge: true },
  });
  if (entries.length === 0) return;

  const sims = await db.simulation.findMany({
    where: { userId },
    orderBy: { openedAt: 'desc' },
    take: 200,
    include: { journalEntry: { select: { id: true } } },
  });

  const samples: SimulationSample[] = sims.map((s, i) => ({
    id: s.id,
    symbol: s.symbol,
    assetClass: s.assetClass,
    mode: s.mode,
    direction: s.direction,
    outcome: s.outcome as SimulationSample['outcome'],
    pnlCents: s.pnlCents,
    stakeCents: s.stakeCents,
    leverage: s.leverage,
    hasStopLoss: s.stopLoss != null,
    hasTakeProfit: s.takeProfit != null,
    riskReward: null,
    rationaleLength: s.rationale.length,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
    hasJournalEntry: Boolean(s.journalEntry),
    minutesSincePrevious: sims[i + 1]
      ? Math.round((s.openedAt.getTime() - sims[i + 1].openedAt.getTime()) / 60000)
      : null,
    strategyTag: s.strategyTag,
  }));

  const stats = computeStats(samples, INITIAL_DEMO_BALANCE_CENTS);

  for (const entry of entries) {
    let progress = 0;
    switch (entry.challenge.metric) {
      case 'STOP_LOSS_COVERAGE':
        progress = stats.stopLossUsagePercent;
        break;
      case 'JOURNAL_COVERAGE':
        progress = stats.journalCoveragePercent;
        break;
      case 'AVG_RISK_PERCENT':
        // Menor es mejor: se expresa como porcentaje de cumplimiento.
        progress = stats.averageRiskPercent <= entry.challenge.target ? 100 : 0;
        break;
      case 'IMPULSIVE_COUNT':
        progress = stats.impulsiveCount === 0 ? 100 : 0;
        break;
      case 'RATIONALE_QUALITY':
        progress = samples.filter((s) => s.rationaleLength >= 200).length;
        break;
      case 'STRATEGY_CONSISTENCY': {
        const counts = new Map<string, number>();
        for (const s of samples) {
          if (!s.strategyTag) continue;
          counts.set(s.strategyTag, (counts.get(s.strategyTag) ?? 0) + 1);
        }
        progress = Math.max(0, ...counts.values());
        break;
      }
      case 'TRACK_PROGRESS':
        progress = (await countCompletedTracks(userId)) > 0 ? 100 : 0;
        break;
      default:
        progress = entry.progress;
    }

    const completed = progress >= entry.challenge.target;
    await db.challengeEntry.update({
      where: { id: entry.id },
      data: { progress, completedAt: completed ? new Date() : null },
    });

    if (completed) {
      await awardXp(userId, entry.challenge.xpReward, `el reto «${entry.challenge.title}»`);
    }
  }
}
