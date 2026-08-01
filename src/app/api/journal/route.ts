import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fromJson, toJson } from '@/lib/json';
import { journalEntrySchema } from '@/lib/validation';
import { historyCutoff } from '@/lib/entitlements';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';
import { awardXp } from '@/lib/gamification';
import { XP_REWARDS } from '@/content/gamification';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const input = journalEntrySchema.parse(await req.json());

    // Si la entrada se asocia a una simulación, se verifica la pertenencia y
    // se congela el contexto del gráfico para poder reconstruirlo después.
    let chartSnapshot: string | null = null;
    if (input.simulationId) {
      const sim = await db.simulation.findFirst({
        where: { id: input.simulationId, userId: user.id },
        select: { contextSnapshot: true },
      });
      if (!sim) {
        return handleError(new Error('Simulación no encontrada'));
      }
      const ctx = fromJson<{ recentCandles?: unknown }>(sim.contextSnapshot, {});
      chartSnapshot = toJson(ctx.recentCandles ?? []);
    }

    const entry = await db.journalEntry.create({
      data: {
        userId: user.id,
        simulationId: input.simulationId,
        title: input.title,
        hypothesis: input.hypothesis,
        entryReason: input.entryReason,
        emotionBefore: input.emotionBefore,
        emotionAfter: input.emotionAfter,
        riskLevel: input.riskLevel,
        indicatorsUsed: toJson(input.indicatorsUsed),
        chartSnapshot,
        result: input.result,
        mistake: input.mistake,
        lesson: input.lesson,
        tags: toJson(input.tags),
      },
    });

    await awardXp(user.id, XP_REWARDS.JOURNAL_ENTRY, 'Entrada de diario registrada');
    await track(ANALYTICS_EVENTS.JOURNAL_ENTRY_CREATED, { hasSimulation: Boolean(input.simulationId) }, { userId: user.id });

    return ok({ id: entry.id }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const tag = req.nextUrl.searchParams.get('tag');
    const emotion = req.nextUrl.searchParams.get('emotion');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200);

    const rows = await db.journalEntry.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: historyCutoff(user.plan) },
        ...(emotion ? { OR: [{ emotionBefore: emotion }, { emotionAfter: emotion }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        simulation: {
          select: {
            symbol: true,
            direction: true,
            outcome: true,
            pnlCents: true,
            stakeCents: true,
            leverage: true,
            entryPrice: true,
            exitPrice: true,
          },
        },
      },
    });

    const entries = rows
      .map((r) => ({
        id: r.id,
        title: r.title,
        hypothesis: r.hypothesis,
        entryReason: r.entryReason,
        emotionBefore: r.emotionBefore,
        emotionAfter: r.emotionAfter,
        riskLevel: r.riskLevel,
        indicatorsUsed: fromJson<string[]>(r.indicatorsUsed, []),
        result: r.result,
        mistake: r.mistake,
        lesson: r.lesson,
        tags: fromJson<string[]>(r.tags, []),
        createdAt: r.createdAt.toISOString(),
        simulation: r.simulation,
      }))
      .filter((e) => !tag || e.tags.includes(tag));

    // Etiquetas y errores más repetidos: alimentan la vista de patrones.
    const tagCounts = new Map<string, number>();
    const mistakeCounts = new Map<string, number>();
    for (const e of entries) {
      for (const t of e.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      if (e.mistake) mistakeCounts.set(e.mistake, (mistakeCounts.get(e.mistake) ?? 0) + 1);
    }

    return ok({
      entries,
      tags: Array.from(tagCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      repeatedMistakes: Array.from(mistakeCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    });
  } catch (error) {
    return handleError(error);
  }
}
