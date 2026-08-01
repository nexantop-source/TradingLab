import { handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { computeStats, RELIABILITY_NOTE, type SimulationSample } from '@tl/simulation-engine';
import { INITIAL_DEMO_BALANCE_CENTS } from '@tl/types';
import { historyCutoff } from '@/lib/entitlements';

/**
 * Estadísticas educativas del estudiante.
 *
 * El indicador de cabecera es la puntuación de disciplina, no la rentabilidad
 * virtual. El porcentaje de aciertos se devuelve siempre junto al tamaño de
 * muestra y a una nota sobre su fiabilidad.
 */
export async function GET() {
  try {
    const { user } = await requireAuth();

    const sims = await db.simulation.findMany({
      where: { userId: user.id, openedAt: { gte: historyCutoff(user.plan) } },
      orderBy: { openedAt: 'desc' },
      take: 500,
      include: { journalEntry: { select: { id: true } } },
    });

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

    // Curva de saldo virtual acumulado, para el gráfico de evolución.
    const closed = sims.filter((s) => s.closedAt && s.pnlCents != null).reverse();
    let running = 0;
    const equityCurve = closed.map((s) => {
      running += s.pnlCents ?? 0;
      return { t: s.closedAt!.getTime(), cumulativeCents: running };
    });

    // Evolución educativa: puntuación media de cuestionarios por semana.
    const attempts = await db.quizAttempt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { score: true, createdAt: true },
    });

    return ok({
      stats,
      reliabilityNote: RELIABILITY_NOTE[stats.sampleReliability],
      equityCurve,
      quizProgress: attempts.map((a) => ({ t: a.createdAt.getTime(), score: a.score })),
      note: 'La puntuación de disciplina es el indicador principal de tu progreso. La rentabilidad virtual, en una muestra pequeña, es ruido estadístico.',
    });
  } catch (error) {
    return handleError(error);
  }
}
