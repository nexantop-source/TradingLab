import 'server-only';
import { db } from './db';
import { toJson, fromJson } from './json';
import { demoTransaction, postManyInTransaction, ensureDemoAccount } from './demo-account';
import { marketData, requireSymbol, snapshotIndicators, activeProviderId, quoteIsTradable, type MarketDataProvider } from '@tl/market-data';
import type { Simulation } from '@prisma/client';
import { entryMinuteSampleTimes } from './entry-minute';
import {
  openSimulation,
  closeSimulation,
  settleHypothesis,
  checkTriggers,
  riskRewardRatio,
  unrealizedPnlCents,
  SimulationError,
  ENGINE_VERSION,
  validateLevels,
  type CreateSimulationInput,
} from '@tl/simulation-engine';
import type {
  CloseReason,
  Candle,
  DataProvenance,
  Direction,
  IndicatorId,
  PlanId,
  SimulationContextSnapshot,
  Timeframe,
} from '@tl/types';
import { TIMEFRAME_SECONDS } from '@tl/types';
import { entitlements } from '@tl/types/plans';
import { assertSimulationMode, checkSimulationLimit, filterIndicators } from './entitlements';
import { ForbiddenError } from './auth';
import { track } from './analytics';
import { ANALYTICS_EVENTS } from '@tl/analytics';

/**
 * Orquestación de simulaciones.
 *
 * Responsabilidades:
 *  · Verificar derechos del plan y límites de uso.
 *  · Obtener el precio con su procedencia y congelar el contexto.
 *  · Delegar el cálculo en `@tl/simulation-engine` (puro y determinístico).
 *  · Registrar los asientos en el libro mayor virtual.
 *
 * Lo que este módulo NO hace: calcular precios ni resultados por su cuenta.
 */

export interface CreateResult {
  simulationId: string;
  entryPrice: number;
  quantity: number;
  feeCents: number;
  balanceCents: number;
  expiresAt: string | null;
  provenance: { provider: string; timestamp: string; latencyMs: number; synthetic: boolean };
}

export async function createSimulation(params: {
  userId: string;
  plan: PlanId;
  timezone: string;
  input: CreateSimulationInput;
}): Promise<CreateResult> {
  const { userId, plan, input } = params;

  assertSimulationMode(plan, input.mode);

  const limit = await checkSimulationLimit(userId, plan);
  if (!limit.allowed) {
    await track(ANALYTICS_EVENTS.PLAN_LIMIT_REACHED, { limit: 'simulations', plan }, { userId });
    throw new SimulationError(limit.message, 'LIMIT_REACHED');
  }

  const meta = requireSymbol(input.symbol);
  if (!assetAvailable(plan, meta.minPlan)) {
    throw new ForbiddenError(
      `${meta.name} está disponible a partir del plan ${meta.minPlan === 'STANDARD' ? 'Standard' : 'Premium'}.`,
    );
  }

  const provider = marketData();
  const status = provider.getMarketStatus(meta.symbol);
  if (status !== 'OPEN') {
    throw new SimulationError(
      `El mercado de ${meta.name} está cerrado en este momento. Consulta su horario de referencia: ${meta.session.label}.`,
      'MARKET_CLOSED',
    );
  }

  const quote = await provider.getQuote(meta.symbol);
  if (process.env.REQUIRE_REAL_MARKET_DATA === 'true' && !quoteIsTradable(quote, provider)) {
    // Un precio viejo y un precio inventado no son el mismo problema, y decirle
    // lo mismo a la persona en los dos casos la deja sin saber qué hacer.
    //
    // Si el precio es real pero lleva horas quieto, lo que pasa es que ese
    // mercado no está negociando: un festivo que nuestro calendario de sesiones
    // no conoce, una media sesión, un cierre imprevisto. Eso se dice tal cual,
    // con la fecha del último cruce, porque es accionable: se vuelve mañana.
    const quieto = !quote.provenance.synthetic && Number.isFinite(quote.provenance.sourceTimestamp);
    throw new SimulationError(
      quieto
        ? `${meta.name} no está negociando ahora mismo: el último cruce real fue el ${new Date(quote.provenance.sourceTimestamp).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' })} UTC. Puede ser un festivo o un cierre imprevisto del mercado.`
        : 'No hay una cotización real vigente para este instrumento. No se abrirá ningún ejercicio con precios sintéticos o desactualizados.',
      quieto ? 'MARKET_CLOSED' : 'INVALID_INPUT',
    );
  }
  const account = await ensureDemoAccount(userId);

  // ── Contexto congelado ───────────────────────────────────────────────────
  const indicators = filterIndicators(plan, input.visibleIndicators) as IndicatorId[];
  const series = await provider.getCandles({
    symbol: meta.symbol,
    timeframe: input.timeframe as Timeframe,
    limit: 220,
  });
  const indicatorValues = snapshotIndicators(series.candles, indicators);

  const context: SimulationContextSnapshot = {
    engineVersion: ENGINE_VERSION,
    timeframe: input.timeframe as Timeframe,
    visibleIndicators: indicators,
    indicatorValues,
    provenance: quote.provenance,
    userTimezone: params.timezone,
    chartType: input.chartType,
    recentCandles: series.candles.slice(-60),
  };

  // ── Apertura ─────────────────────────────────────────────────────────────
  const direction: Direction | null =
    input.mode === 'PORTFOLIO' ? (input.side === 'BUY' ? 'BULLISH' : 'BEARISH') : input.direction;

  const leverage = input.mode === 'POSITION' ? input.leverage : 1;

  const opened = openSimulation({
    mode: input.mode,
    direction,
    midPrice: quote.price,
    spreadBps: meta.spreadBps,
    stakeCents: input.stakeCents,
    leverage,
    precision: meta.precision,
  });

  if (input.mode === 'POSITION') {
    const levels = validateLevels({
      direction: input.direction,
      entryPrice: opened.entryPrice,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
    });
    if (!levels.ok) throw new SimulationError(levels.message, 'INVALID_INPUT');
  }

  const expiresAt =
    input.mode === 'HYPOTHESIS' || (input.mode === 'POSITION' && input.durationMinutes != null)
      ? new Date(Date.now() + input.durationMinutes! * 60_000) : null;

  // ── Persistencia y asientos ──────────────────────────────────────────────
  const { simulation, balance } = await demoTransaction(async tx => {
    // Se vuelve a comprobar dentro de la transacción: entre cotizar y persistir
    // hay una carga de contexto y puede haber reintentos, y en ese hueco el
    // precio envejece.
    //
    // Con la misma regla que la primera puerta, y no con otro número escrito a
    // mano. Tenía diez segundos, heredados de cuando la única fuente entregaba
    // un precio por segundo: dejaba pasar el euro en la primera comprobación y
    // lo rechazaba aquí, de forma intermitente, según lo que tardara la base.
    if (process.env.REQUIRE_REAL_MARKET_DATA === 'true' && !quoteIsTradable(quote, provider)) {
      throw new SimulationError('La cotización venció antes de abrir el ejercicio. Inténtalo con un precio actualizado.', 'INVALID_INPUT');
    }
    const dailyLimit = entitlements(plan).simulationsPerDay;
    if (dailyLimit != null) {
      // The early limit check is feedback, not the final claim. Serialize
      // limited opens on the user row and recount in the same transaction so
      // parallel requests cannot both spend the last daily allowance.
      await tx.user.update({ where: { id: userId }, data: { updatedAt: new Date() } });
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const used = await tx.simulation.count({ where: { userId, openedAt: { gte: dayStart } } });
      if (used >= dailyLimit) {
        throw new SimulationError(
          `Has alcanzado el límite de ${dailyLimit} simulaciones diarias del plan ${entitlements(plan).name}. El límite se reinicia a las 00:00 UTC.`,
          'LIMIT_REACHED',
        );
      }
    }
    const simulation = await tx.simulation.create({
      data: {
        userId,
        demoAccountId: account.id,
        portfolioId: input.mode === 'PORTFOLIO' ? input.portfolioId : null,
        mode: input.mode,
        symbol: meta.symbol,
        assetClass: meta.assetClass,
        direction,
        status: 'OPEN',
        outcome: 'PENDING',
        orderType: input.mode === 'POSITION' ? input.orderType : 'MARKET',
        stakeCents: input.stakeCents,
        leverage,
        quantity: opened.quantity,
        entryPrice: opened.entryPrice,
        limitPrice: input.mode === 'POSITION' ? input.limitPrice : null,
        stopLoss: input.mode === 'POSITION' ? input.stopLoss : null,
        takeProfit: input.mode === 'POSITION' ? input.takeProfit : null,
        trailingStopDistance: input.mode === 'POSITION' ? input.trailingStopDistance : null,
        feeCents: opened.feeCents,
        openedAt: new Date(),
        expiresAt,
        rationale: input.rationale,
        confidence: input.confidence,
        perceivedRisk: input.perceivedRisk,
        engineVersion: ENGINE_VERSION,
        priceSourceProvider: quote.provenance.provider,
        priceSourceTimestamp: new Date(quote.provenance.sourceTimestamp),
        entryLatencyMs: safeLatency(quote.provenance.latencyMs),
        userTimezone: params.timezone,
        contextSnapshot: toJson(context),
      },
    });

    const balance = await postManyInTransaction(tx, account.id, [
      {
        amountCents: -input.stakeCents,
        reason: 'SIMULATION_MARGIN_HOLD',
        reference: simulation.id,
        memo: `Margen virtual retenido para la simulación de ${meta.symbol}.`,
      },
      {
        amountCents: -opened.feeCents,
        reason: 'SIMULATION_FEE',
        reference: simulation.id,
        memo: 'Spread virtual educativo aplicado en la apertura.',
      },
    ]);
    return { simulation, balance };
  });

  const isFirst = (await db.simulation.count({ where: { userId } })) === 1;
  await track(
    isFirst ? ANALYTICS_EVENTS.FIRST_SIMULATION_CREATED : ANALYTICS_EVENTS.SIMULATION_CREATED,
    {
      mode: input.mode,
      symbol: meta.symbol,
      assetClass: meta.assetClass,
      leverage,
      hasStopLoss: input.mode === 'POSITION' && input.stopLoss != null,
      stakeCents: input.stakeCents,
      plan,
    },
    { userId },
  );

  return {
    simulationId: simulation.id,
    entryPrice: opened.entryPrice,
    quantity: opened.quantity,
    feeCents: opened.feeCents,
    balanceCents: balance,
    expiresAt: expiresAt?.toISOString() ?? null,
    provenance: {
      provider: quote.provenance.providerLabel,
      timestamp: new Date(quote.provenance.sourceTimestamp).toISOString(),
      latencyMs: quote.provenance.latencyMs,
      synthetic: quote.provenance.synthetic,
    },
  };
}

function assetAvailable(plan: PlanId, minPlan: string): boolean {
  const order: Record<string, number> = { FREE: 0, STANDARD: 1, PREMIUM: 2 };
  return order[plan] >= order[minPlan];
}

/**
 * Latencia acotada antes de persistir.
 *
 * Defensa frente a un proveedor que informe un valor absurdo: la columna es un
 * entero de 32 bits y un dato erróneo no debe poder corromper la fila ni
 * impedir después la lectura del historial. Se acota a una hora.
 */
const MAX_STORED_LATENCY_MS = 3_600_000;

function safeLatency(ms: number | null | undefined): number {
  if (ms == null || !Number.isFinite(ms)) return 0;
  return Math.max(0, Math.min(Math.round(ms), MAX_STORED_LATENCY_MS));
}

// ─────────────────────────────────────────────────────────────────────────────
// Cierre
// ─────────────────────────────────────────────────────────────────────────────

export interface CloseResultDto {
  simulationId: string;
  exitPrice: number;
  pnlCents: number;
  outcome: string;
  closeReason: CloseReason;
  balanceCents: number;
  returnOnMarginPercent: number;
  audit: string[];
}

interface CloseParams {
  userId: string;
  simulationId: string;
  fraction?: number;
  reason?: CloseReason;
  /** Instante de cierre. Se parametriza para poder liquidar vencimientos pasados. */
  at?: number;
}

export async function closeSimulationById(params: CloseParams): Promise<CloseResultDto> {
  return closeWithValidatedTrigger(params);
}

/** The optional evidence is private to this module, never an API field. */
async function closeWithValidatedTrigger(params: CloseParams, checkedTrigger?: PositionTrigger): Promise<CloseResultDto> {
  const sim = await db.simulation.findFirst({
    where: { id: params.simulationId, userId: params.userId },
  });
  if (!sim) throw new SimulationError('No se ha encontrado la simulación indicada.', 'INVALID_INPUT');
  if (sim.status !== 'OPEN') {
    throw new SimulationError('Esta simulación ya está cerrada.', 'INVALID_INPUT');
  }

  const meta = requireSymbol(sim.symbol);
  const provider = marketData();
  const requestedAt = params.at ?? Date.now();
  const expiredPosition = sim.mode === 'POSITION' && sim.expiresAt != null && requestedAt >= sim.expiresAt.getTime();
  const at = expiredPosition ? sim.expiresAt!.getTime() : requestedAt;
  const { price: exitMid, provenance: quoteProvenance } = await provider.getPriceAt(sim.symbol, at);
  let provenance = quoteProvenance;

  let fraction = expiredPosition ? 1 : params.fraction ?? 1;
  let reason: CloseReason = expiredPosition ? 'EXPIRY' : params.reason ?? (fraction < 1 ? 'PARTIAL' : 'MANUAL');
  let effectiveExit = exitMid;

  // ── Modo hipótesis ───────────────────────────────────────────────────────
  if (sim.mode === 'HYPOTHESIS') {
    const context = fromJson<SimulationContextSnapshot | null>(sim.contextSnapshot, null);
    const atr = context?.indicatorValues?.['ATR14'] ?? null;
    const referenceMovePercent = atr != null && sim.entryPrice > 0 ? (atr / sim.entryPrice) * 100 : 0.35;

    const settled = settleHypothesis({
      direction: (sim.direction ?? 'BULLISH') as Direction,
      entryPrice: sim.entryPrice,
      exitPrice: exitMid,
      stakeCents: sim.stakeCents,
      referenceMovePercent,
    });

    const settlementCents = Math.max(0, sim.stakeCents + settled.pnlCents);
    const balance = await demoTransaction(async tx => {
      const claimed = await tx.simulation.updateMany({
        where: { id: sim.id, userId: params.userId, status: 'OPEN', quantity: sim.quantity, stakeCents: sim.stakeCents },
        data: {
          status: 'CLOSED',
          outcome: settled.outcome,
          exitPrice: exitMid,
          pnlCents: settled.pnlCents,
          closedAt: new Date(at),
          closeReason: params.reason ?? 'EXPIRY',
          exitSourceProvider: provenance.provider,
          exitSourceTimestamp: new Date(provenance.sourceTimestamp),
          exitLatencyMs: safeLatency(provenance.latencyMs),
          settlementAudit: toJson(settled.audit),
        },
      });
      if (claimed.count !== 1) throw settlementConflict();
      return postManyInTransaction(tx, sim.demoAccountId, [{
        amountCents: settlementCents,
        reason: 'SIMULATION_SETTLEMENT',
        reference: sim.id,
        memo: `Liquidación de hipótesis ${sim.direction === 'BEARISH' ? 'bajista' : 'alcista'} sobre ${sim.symbol}.`,
      }]);
    });

    await track(
      ANALYTICS_EVENTS.SIMULATION_CLOSED,
      { mode: 'HYPOTHESIS', symbol: sim.symbol, outcome: settled.outcome, pnlCents: settled.pnlCents },
      { userId: params.userId },
    );

    return {
      simulationId: sim.id,
      exitPrice: exitMid,
      pnlCents: settled.pnlCents,
      outcome: settled.outcome,
      closeReason: params.reason ?? 'EXPIRY',
      balanceCents: balance,
      returnOnMarginPercent: Number(((settled.pnlCents / sim.stakeCents) * 100).toFixed(2)),
      audit: settled.audit,
    };
  }

  // ── Modos posición y portafolio ──────────────────────────────────────────
  // A manual / partial request cannot bypass an already observed protective
  // trigger. Manual and background-visible polling use identical evidence.
  const trigger = checkedTrigger ?? (sim.mode === 'POSITION' ? await positionTrigger(provider, sim, at) : null);
  if (trigger) {
    if (trigger.fingerprint !== positionFingerprint(sim) || trigger.observedAt > at || trigger.windowStart < sim.openedAt.getTime()) throw settlementConflict();
    reason = trigger.reason;
    effectiveExit = trigger.price;
    provenance = trigger.provenance;
    fraction = 1;
  }

  const result = closeSimulation({
    mode: sim.mode as 'POSITION' | 'PORTFOLIO',
    direction: sim.direction as Direction,
    entryPrice: sim.entryPrice,
    exitMidPrice: effectiveExit,
    spreadBps: meta.spreadBps,
    quantity: sim.quantity,
    stakeCents: sim.stakeCents,
    leverage: sim.leverage,
    precision: meta.precision,
    closeReason: reason,
    openFeeCents: sim.feeCents,
    fraction,
  });
  if (trigger) result.audit.push(
    `disparoNivelMedio=${trigger.price} origen=${trigger.partialEntry ? 'minutoEntrada_segundosCompletos' : 'velas_1m'}`,
    `ventanaDisparoInicio=${new Date(trigger.windowStart).toISOString()} ventanaDisparoFin=${new Date(trigger.windowEnd).toISOString()}`,
    `evaluadoHasta=${new Date(trigger.observedAt).toISOString()} cierreRegistrado=${new Date(at).toISOString()} lookbackMaximo=600_velas_1m`,
    'El nivel de protección se usa como precio medio educativo y se aplica el spread de cierre; OHLC no acredita un tick exacto de ejecución.',
  );

  const fullyClosed = fraction >= 1;
  const balance = await demoTransaction(async tx => {
    const claimed = await tx.simulation.updateMany({
      where: { id: sim.id, userId: params.userId, status: 'OPEN', quantity: sim.quantity, stakeCents: sim.stakeCents },
      data: {
        status: fullyClosed ? 'CLOSED' : 'OPEN',
        outcome: fullyClosed ? result.outcome : 'PENDING',
        exitPrice: fullyClosed ? result.exitPrice : null,
        pnlCents: fullyClosed ? result.pnlCents : (sim.pnlCents ?? 0) + result.pnlCents,
        closedAt: fullyClosed ? new Date(at) : null,
        closeReason: fullyClosed ? reason : null,
        quantity: fullyClosed ? sim.quantity : sim.quantity * (1 - fraction),
        stakeCents: fullyClosed ? sim.stakeCents : Math.round(sim.stakeCents * (1 - fraction)),
        exitSourceProvider: provenance.provider,
        exitSourceTimestamp: new Date(provenance.sourceTimestamp),
        exitLatencyMs: safeLatency(provenance.latencyMs),
        settlementAudit: toJson(result.audit),
      },
    });
    if (claimed.count !== 1) throw settlementConflict();
    return postManyInTransaction(tx, sim.demoAccountId, [{
      amountCents: result.settlementCents,
      reason: 'SIMULATION_SETTLEMENT',
      reference: sim.id,
      memo: `Liquidación ${fraction < 1 ? 'parcial' : 'total'} de la posición simulada en ${sim.symbol} (${reason}).`,
    }]);
  });

  await track(
    ANALYTICS_EVENTS.SIMULATION_CLOSED,
    {
      mode: sim.mode,
      symbol: sim.symbol,
      outcome: result.outcome,
      pnlCents: result.pnlCents,
      closeReason: reason,
      partial: !fullyClosed,
    },
    { userId: params.userId },
  );

  return {
    simulationId: sim.id,
    exitPrice: result.exitPrice,
    pnlCents: result.pnlCents,
    outcome: result.outcome,
    closeReason: reason,
    balanceCents: balance,
    returnOnMarginPercent: result.returnOnMarginPercent,
    audit: result.audit,
  };
}

function settlementConflict() {
  return new SimulationError('Esta simulación ya fue cerrada o cambió durante el cierre. Actualiza tus posiciones antes de intentarlo de nuevo.', 'INVALID_INPUT');
}

type ProtectionReason = 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP';
interface PositionTrigger {
  fingerprint: string; reason: ProtectionReason; price: number;
  observedAt: number; windowStart: number; windowEnd: number;
  provenance: DataProvenance; partialEntry: boolean;
}

function positionFingerprint(sim: Simulation): string {
  return JSON.stringify([sim.id, sim.userId, sim.symbol, sim.openedAt.getTime(), sim.entryPrice, sim.direction, sim.stopLoss, sim.takeProfit, sim.trailingStopDistance, sim.quantity, sim.stakeCents]);
}

/** Bounded, opportunistic protection evaluation. Entry-minute OHLC would include
 * movement from before the position existed, so reconstruct only that fragment
 * from at most 60 completed-second observations. No future or pre-entry price.
 */
async function positionTrigger(provider: MarketDataProvider, sim: Simulation, at: number): Promise<PositionTrigger | null> {
  if (sim.stopLoss == null && sim.takeProfit == null && sim.trailingStopDistance == null) return null;
  const observedAt = Math.floor(Math.min(at, Date.now()) / 1000) * 1000;
  const openedAt = sim.openedAt.getTime();
  if (observedAt < openedAt) return null;
  const nextMinute = Math.floor(openedAt / 60_000) * 60_000 + 60_000;
  const lookbackStart = Math.floor(observedAt / 60_000) * 60_000 - 599 * 60_000;
  const series = await provider.getCandles({ symbol: sim.symbol, timeframe: '1m', limit: 600, to: observedAt });
  const candles = series.candles.filter(candle => candle.t >= Math.max(nextMinute, lookbackStart) && candle.t <= observedAt
    && provider.getMarketStatus(sim.symbol, candle.t) === 'OPEN');
  let fragment: Candle | null = null;
  let fragmentProvenance: DataProvenance | null = null;
  let fragmentEnd: number | null = null;
  const times = openedAt >= lookbackStart ? entryMinuteSampleTimes(openedAt, observedAt) : [];
  if (times.length) {
    const samples = [];
    for (const time of times) {
      const sample = await provider.getPriceAt(sim.symbol, time);
      if (!Number.isFinite(sample.price) || sample.price <= 0 || !Number.isFinite(sample.provenance.sourceTimestamp) || sample.provenance.sourceTimestamp < 0 || sample.provenance.sourceTimestamp > time) {
        throw new SimulationError('No hay una observación válida del precio para evaluar la protección.', 'INVALID_INPUT');
      }
      if (sample.provenance.sourceTimestamp < openedAt) {
        // Older positions may have been opened during a now-disallowed
        // pre-open session. A declared frozen close is not a post-entry price
        // observation: omit it, but still let the student close the position.
        const legitimatelyFrozen = sample.provenance.freshness === 'MARKET_CLOSED'
          && ['CLOSED', 'PRE_OPEN', 'HOLIDAY'].includes(sample.provenance.marketStatus);
        // A completed exchange second ends 1 ms before its boundary. Skip
        // that first pre-entry close, never include it in a protection bar.
        const precedingExchangeClose = !sample.provenance.synthetic
          && time - sample.provenance.sourceTimestamp <= 1000;
        if (legitimatelyFrozen || precedingExchangeClose) continue;
        throw new SimulationError('No hay una observación válida del precio para evaluar la protección.', 'INVALID_INPUT');
      }
      samples.push({ ...sample, time });
    }
    if (samples.length) {
      const prices = samples.map(sample => sample.price);
      fragment = { t: samples[0].time, o: prices[0], h: Math.max(...prices), l: Math.min(...prices), c: prices[prices.length - 1], v: 0 };
      fragmentProvenance = samples[samples.length - 1].provenance;
      fragmentEnd = samples[samples.length - 1].time;
      candles.unshift(fragment);
    }
  }
  const trigger = checkTriggers({ direction: sim.direction as Direction, stopLoss: sim.stopLoss, takeProfit: sim.takeProfit, trailingStopDistance: sim.trailingStopDistance, entryPrice: sim.entryPrice, candles });
  if (!trigger.triggered || trigger.at == null || trigger.price == null || !Number.isFinite(trigger.price) || trigger.price <= 0 || !['STOP_LOSS', 'TAKE_PROFIT', 'TRAILING_STOP'].includes(trigger.reason ?? '')) return null;
  const partialEntry = fragment != null && trigger.at === fragment.t;
  return {
    fingerprint: positionFingerprint(sim), price: trigger.price, reason: trigger.reason as ProtectionReason,
    observedAt, windowStart: trigger.at, windowEnd: Math.min(observedAt, partialEntry ? fragmentEnd! : trigger.at + 60_000),
    provenance: partialEntry ? fragmentProvenance! : series.provenance, partialEntry,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Liquidación de vencimientos y disparos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liquida las simulaciones vencidas del usuario.
 *
 * Se invoca de forma oportunista al cargar el panel o la terminal. En
 * producción conviene además una tarea programada; el resultado es idéntico
 * porque el motor es determinístico: liquidar a las 12:00:03 o a las 12:05
 * usa el precio del instante de vencimiento, no el del momento de ejecución.
 */
export async function settleDueSimulations(userId: string): Promise<number> {
  const now = Date.now();
  const due = await db.simulation.findMany({
    where: { userId, status: 'OPEN', mode: { in: ['HYPOTHESIS', 'POSITION'] }, expiresAt: { lte: new Date(now) } },
    select: { id: true, expiresAt: true },
    take: 50,
  });

  let settled = 0;
  for (const s of due) {
    try {
      await closeSimulationById({
        userId,
        simulationId: s.id,
        reason: 'EXPIRY',
        at: s.expiresAt!.getTime(),
      });
      settled++;
    } catch (error) {
      console.error('[simulation] No se pudo liquidar el vencimiento', s.id, error);
    }
  }

  // Comprueba disparos de stop loss y take profit en posiciones abiertas.
  const positions = await db.simulation.findMany({
    where: { userId, status: 'OPEN', mode: 'POSITION' },
    take: 50,
  });
  const provider = marketData();
  for (const p of positions) {
    if (p.stopLoss == null && p.takeProfit == null && p.trailingStopDistance == null) continue;
    try {
      const trig = await positionTrigger(provider, p, now);
      if (trig) {
        await closeWithValidatedTrigger({
          userId,
          simulationId: p.id,
          reason: trig.reason,
          at: now,
        }, trig);
        settled++;
      }
    } catch (error) {
      console.error('[simulation] No se pudo evaluar el disparo', p.id, error);
    }
  }

  return settled;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura enriquecida
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenPositionDto {
  id: string;
  mode: string;
  symbol: string;
  assetName: string;
  direction: string | null;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stakeCents: number;
  leverage: number;
  stopLoss: number | null;
  takeProfit: number | null;
  unrealizedPnlCents: number;
  unrealizedPercent: number;
  riskReward: number | null;
  openedAt: string;
  expiresAt: string | null;
  precision: number;
  provider: string;
  latencyMs: number;
  synthetic: boolean;
  marketStatus: string;
}

export async function listOpenPositions(userId: string, options: { all?: boolean } = {}): Promise<OpenPositionDto[]> {
  const rows = await db.simulation.findMany({
    where: { userId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
    take: options.all ? undefined : 50,
  });
  if (rows.length === 0) return [];

  const provider = marketData();
  const symbols = Array.from(new Set(rows.map((r) => r.symbol)));
  const quotes = await provider.getQuotes(symbols);
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

  return rows.map((r) => {
    const q = bySymbol.get(r.symbol);
    const meta = requireSymbol(r.symbol);
    const current = q?.price ?? r.entryPrice;
    const pnl = unrealizedPnlCents({
      direction: r.direction as Direction,
      entryPrice: r.entryPrice,
      currentPrice: current,
      quantity: r.quantity,
    });
    return {
      id: r.id,
      mode: r.mode,
      symbol: r.symbol,
      assetName: meta.name,
      direction: r.direction,
      entryPrice: r.entryPrice,
      currentPrice: current,
      quantity: r.quantity,
      stakeCents: r.stakeCents,
      leverage: r.leverage,
      stopLoss: r.stopLoss,
      takeProfit: r.takeProfit,
      unrealizedPnlCents: pnl,
      unrealizedPercent: Number(((pnl / r.stakeCents) * 100).toFixed(2)),
      riskReward:
        r.direction && r.stopLoss != null && r.takeProfit != null
          ? riskRewardRatio({
              direction: r.direction as Direction,
              entryPrice: r.entryPrice,
              stopLoss: r.stopLoss,
              takeProfit: r.takeProfit,
            })
          : null,
      openedAt: r.openedAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString() ?? null,
      precision: meta.precision,
      provider: q?.provenance.providerLabel ?? r.priceSourceProvider,
      latencyMs: q?.provenance.latencyMs ?? 0,
      synthetic: q?.provenance.synthetic ?? true,
      marketStatus: q?.provenance.marketStatus ?? 'CLOSED',
    };
  });
}

/** Duración en milisegundos de una temporalidad. Reexportado por comodidad. */
export function timeframeMs(tf: Timeframe): number {
  return TIMEFRAME_SECONDS[tf] * 1000;
}

export { activeProviderId };
