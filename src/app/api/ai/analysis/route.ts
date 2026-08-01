import { NextRequest } from 'next/server';
import { handleError, ok, fail } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { enforce, RATE_LIMITS } from '@/lib/rate-limit';
import { aiAnalysisRequestSchema } from '@/lib/validation';
import { db } from '@/lib/db';
import { toJson, fromJson } from '@/lib/json';
import { checkAILimit, filterIndicators } from '@/lib/entitlements';
import { addToSnapshot, overBudget } from '@/lib/ai-budget';
import { track } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';
import { marketData, requireSymbol, snapshotIndicators, getEventsForSymbol } from '@tl/market-data';
import { computeStats, type SimulationSample } from '@tl/simulation-engine';
import {
  AIUnavailableError,
  buildJournalContextBlock,
  buildLessonCatalogBlock,
  buildMarketContextBlock,
  buildTradeContextBlock,
  callEducationalModel,
  deterministicChartReview,
  deterministicJournalReview,
  deterministicPostTrade,
  DETERMINISTIC_ENGINE_ID,
  enforceDisclaimer,
  isAIConfigured,
  KIND_INSTRUCTION,
  moderateInput,
  PROMPT_FOR_KIND,
  runGuardrails,
  sanitizeUserInput,
  type MarketContext,
} from '@tl/ai';
import { allLessons } from '@/content/academy';
import type { AIEducationalAnalysis, IndicatorId, Timeframe } from '@tl/types';
import { INITIAL_DEMO_BALANCE_CENTS } from '@tl/types';

/**
 * Entrenador educativo.
 *
 * Flujo:
 *  1. Autenticación, límite de plan y limitación de frecuencia.
 *  2. El backend obtiene los precios y calcula los indicadores.
 *  3. Se construye el contexto: solo datos de mercado y texto del propio
 *     estudiante, ya saneado. Sin datos personales.
 *  4. Se llama al modelo con salida estructurada obligatoria.
 *  5. Se aplican los guardarraíles. Si no pasa, se sirve el análisis
 *     determinístico y se registra el incidente.
 *  6. Se persiste el análisis con su coste, su versión de prompt y el informe
 *     de guardarraíles.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    await enforce(`ai:${user.id}`, RATE_LIMITS.ai);

    const input = aiAnalysisRequestSchema.parse(await req.json());

    const limit = await checkAILimit(user.id, user.plan);
    if (!limit.allowed) {
      await track(ANALYTICS_EVENTS.PLAN_LIMIT_REACHED, { limit: 'ai', plan: user.plan }, { userId: user.id });
      return fail('AI_LIMIT_REACHED', limit.message, 429, { used: limit.used, limit: limit.limit, upgradeTo: limit.upgradeTo });
    }

    const lessons = allLessons().map((l) => ({ slug: l.slug, title: l.title, topic: l.topic }));
    const question = input.question ? sanitizeUserInput(input.question) : null;

    if (question && isAIConfigured()) {
      const moderation = await moderateInput(question);
      if (moderation.flagged) {
        return fail(
          'CONTENT_MODERATED',
          'Tu mensaje no cumple las normas de uso de la plataforma. Reformúlalo centrándote en el análisis educativo.',
          400,
        );
      }
    }

    // ── Construcción del contexto ─────────────────────────────────────────
    let contextBlocks: string[] = [];
    let fallback: AIEducationalAnalysis;
    let marketContext: MarketContext | null = null;
    let allowedIndicatorValues: Record<string, number | null> = {};
    let symbol: string | null = null;
    let timeframe: Timeframe | null = null;

    if (input.kind === 'JOURNAL_REVIEW') {
      const journal = await buildJournalContext(user.id);
      contextBlocks = [buildJournalContextBlock(journal), buildLessonCatalogBlock(lessons)];
      fallback = deterministicJournalReview(journal, lessons);
    } else if (input.kind === 'POST_TRADE') {
      if (!input.simulationId) {
        return fail('MISSING_SIMULATION', 'Indica la simulación que quieres revisar.', 400);
      }
      const sim = await db.simulation.findFirst({ where: { id: input.simulationId, userId: user.id } });
      if (!sim) return fail('NOT_FOUND', 'No se ha encontrado la simulación indicada.', 404);
      if (sim.status !== 'CLOSED') {
        return fail('SIMULATION_OPEN', 'La revisión posterior solo está disponible para simulaciones cerradas.', 400);
      }

      marketContext = await buildMarketContext(sim.symbol, '1h', ['SMA20', 'RSI14', 'ATR14', 'MACD']);
      allowedIndicatorValues = marketContext.indicators;

      const trade = {
        mode: sim.mode,
        direction: sim.direction,
        entryPrice: sim.entryPrice,
        exitPrice: sim.exitPrice,
        stopLoss: sim.stopLoss,
        takeProfit: sim.takeProfit,
        leverage: sim.leverage,
        stakeUsd: sim.stakeCents / 100,
        riskReward:
          sim.stopLoss != null && sim.takeProfit != null
            ? Number(
                (
                  Math.abs(sim.takeProfit - sim.entryPrice) / Math.abs(sim.entryPrice - sim.stopLoss)
                ).toFixed(2),
              )
            : null,
        outcome: sim.outcome,
        pnlUsd: sim.pnlCents != null ? sim.pnlCents / 100 : null,
        durationMinutes:
          sim.closedAt != null
            ? Math.round((sim.closedAt.getTime() - sim.openedAt.getTime()) / 60000)
            : null,
        studentRationale: sanitizeUserInput(sim.rationale),
        confidence: sim.confidence,
        perceivedRisk: sim.perceivedRisk,
      };

      contextBlocks = [buildTradeContextBlock(marketContext, trade), buildLessonCatalogBlock(lessons)];
      fallback = deterministicPostTrade(marketContext, trade, lessons);
      symbol = sim.symbol;
    } else {
      // CHART_REVIEW, NEWS_EXPLAINER y CONCEPT comparten el contexto de mercado.
      if (!input.symbol) return fail('MISSING_SYMBOL', 'Indica el instrumento que quieres analizar.', 400);
      const indicators = filterIndicators(user.plan, input.indicators.length ? input.indicators : ['SMA20', 'RSI14', 'ATR14']);
      marketContext = await buildMarketContext(
        input.symbol,
        (input.timeframe ?? '1h') as Timeframe,
        indicators,
      );
      allowedIndicatorValues = marketContext.indicators;
      contextBlocks = [buildMarketContextBlock(marketContext), buildLessonCatalogBlock(lessons)];
      fallback = deterministicChartReview(marketContext, lessons);
      symbol = marketContext.symbol;
      timeframe = marketContext.timeframe;
    }

    if (question) {
      contextBlocks.push(`PREGUNTA_DEL_ESTUDIANTE\n${question}`);
    }

    // ── Llamada al modelo ─────────────────────────────────────────────────
    const promptVersionId = PROMPT_FOR_KIND[input.kind];
    let analysis: AIEducationalAnalysis = fallback;
    let engine = DETERMINISTIC_ENGINE_ID;
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let costUsd = 0;
    let latencyMs = 0;
    let degradedReason: string | null = null;

    if (isAIConfigured() && !(await overBudget())) {
      try {
        const result = await callEducationalModel({
          promptVersionId,
          contextBlocks,
          instruction: KIND_INSTRUCTION[input.kind],
        });
        const guarded = runGuardrails(result.analysis, { allowedIndicatorValues });
        if (guarded.passed) {
          analysis = result.analysis;
          engine = result.model;
        } else {
          degradedReason = `Guardarraíles: ${guarded.violations.map((v) => v.rule).join(', ')}`;
          await track(
            ANALYTICS_EVENTS.AI_GUARDRAIL_TRIGGERED,
            { kind: input.kind, violations: guarded.violations.map((v) => v.rule) },
            { userId: user.id },
          );
        }
        usage = result.usage;
        costUsd = result.costUsd;
        latencyMs = result.latencyMs;
      } catch (error) {
        if (error instanceof AIUnavailableError) {
          degradedReason = `Proveedor no disponible (${error.reason})`;
        } else {
          throw error;
        }
      }
    } else if (!isAIConfigured()) {
      degradedReason = 'Sin credencial de proveedor configurada';
    } else {
      degradedReason = 'Tope de coste mensual alcanzado';
    }

    analysis = enforceDisclaimer(analysis);

    // Guardarraíles también sobre el análisis determinístico: la regla es la
    // misma para todos los motores.
    const finalGuardrails = runGuardrails(analysis, { allowedIndicatorValues });

    // ── Persistencia ──────────────────────────────────────────────────────
    const record = await db.aIAnalysis.create({
      data: {
        userId: user.id,
        simulationId: input.simulationId ?? null,
        kind: input.kind,
        symbol,
        timeframe,
        payload: toJson(analysis),
        engine,
        promptVersionId,
        guardrailReport: toJson({ ...finalGuardrails, degradedReason }),
        flagged: !finalGuardrails.passed,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd,
        latencyMs,
      },
    });

    await recordUsage(user.id, costUsd);
    await track(
      ANALYTICS_EVENTS.AI_ANALYSIS_REQUESTED,
      { kind: input.kind, engine, symbol, plan: user.plan, degraded: Boolean(degradedReason) },
      { userId: user.id },
    );

    return ok({
      id: record.id,
      analysis,
      engine,
      promptVersionId,
      degraded: Boolean(degradedReason),
      /** Se comunica al usuario qué motor generó el análisis, sin excepción. */
      engineNotice:
        engine === DETERMINISTIC_ENGINE_ID
          ? 'Análisis generado por el motor educativo determinístico de TradingLab.'
          : `Análisis generado por el modelo ${engine}, verificado por los guardarraíles de la plataforma.`,
      usage: { used: limit.used + 1, limit: limit.limit },
    });
  } catch (error) {
    return handleError(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function buildMarketContext(
  symbolInput: string,
  timeframe: Timeframe,
  indicators: IndicatorId[],
): Promise<MarketContext> {
  const meta = requireSymbol(symbolInput);
  const provider = marketData();

  const [quote, series] = await Promise.all([
    provider.getQuote(meta.symbol),
    provider.getCandles({ symbol: meta.symbol, timeframe, limit: 250 }),
  ]);

  const events = getEventsForSymbol(meta.symbol, Date.now(), Date.now() + 7 * 86400000).slice(0, 5);

  return {
    symbol: meta.symbol,
    assetName: meta.name,
    assetClass: meta.assetClass,
    timeframe,
    currentPrice: quote.price,
    changePercent: quote.changePercent,
    dayHigh: quote.dayHigh,
    dayLow: quote.dayLow,
    // Solo las últimas 80 velas: suficiente para describir estructura y
    // mantiene acotado el coste de tokens.
    candles: series.candles.slice(-80),
    indicators: snapshotIndicators(series.candles, indicators),
    provenance: quote.provenance,
    upcomingEvents: events.map((e) => ({
      title: e.title,
      timeIso: new Date(e.time).toISOString(),
      impact: e.impact,
    })),
  };
}

async function buildJournalContext(userId: string) {
  const sims = await db.simulation.findMany({
    where: { userId },
    orderBy: { openedAt: 'desc' },
    take: 200,
    include: { journalEntry: true },
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

  const entries = await db.journalEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { emotionBefore: true, emotionAfter: true, lesson: true, mistake: true },
  });

  return {
    totalSimulations: stats.totalSimulations,
    hitRatePercent: stats.hitRatePercent,
    sampleReliability: stats.sampleReliability,
    stopLossUsagePercent: stats.stopLossUsagePercent,
    averageRiskPercent: stats.averageRiskPercent,
    averageRiskReward: stats.averageRiskReward,
    impulsivePercent: stats.impulsivePercent,
    averageLeverage: stats.averageLeverage,
    disciplineScore: stats.disciplineScore,
    repeatedMistakes: stats.repeatedMistakes,
    recentEntries: entries.map((e) => ({
      emotionBefore: e.emotionBefore,
      emotionAfter: e.emotionAfter ?? 'no registrada',
      lesson: sanitizeUserInput(e.lesson ?? '', 300),
      mistake: sanitizeUserInput(e.mistake ?? '', 300),
    })),
  };
}

async function recordUsage(userId: string, costUsd: number) {
  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  await db.aIUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, month, calls: 1, costUsd },
    update: { calls: { increment: 1 }, costUsd: { increment: costUsd } },
  });
  addToSnapshot(costUsd);
}
