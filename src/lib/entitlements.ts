import 'server-only';
import { db } from './db';
import { entitlements, planAtLeast } from '@tl/types/plans';
import type { IndicatorId, PlanId, SimulationMode } from '@tl/types';
import { ForbiddenError } from './auth';

/**
 * Comprobación de derechos en el servidor.
 *
 * La interfaz también oculta lo que un plan no incluye, pero eso es cortesía,
 * no seguridad: el límite se aplica aquí, en cada endpoint.
 */

export interface UsageSnapshot {
  simulationsToday: number;
  aiCallsToday: number;
  aiCallsThisMonth: number;
  portfolios: number;
  activeAlerts: number;
  balanceResetsThisMonth: number;
}

export async function getUsage(userId: string): Promise<UsageSnapshot> {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const startOfDay = new Date(`${day}T00:00:00.000Z`);

  const [simulationsToday, usageToday, usageMonth, portfolios, activeAlerts, demoAccount] =
    await Promise.all([
      db.simulation.count({ where: { userId, openedAt: { gte: startOfDay } } }),
      db.aIUsage.findUnique({ where: { userId_day: { userId, day } } }),
      db.aIUsage.aggregate({ where: { userId, month }, _sum: { calls: true } }),
      db.portfolio.count({ where: { userId } }),
      db.alert.count({ where: { userId, active: true } }),
      db.demoAccount.findFirst({ where: { userId }, select: { resetsThisMonth: true, lastResetAt: true } }),
    ]);

  const resetsThisMonth =
    demoAccount?.lastResetAt && demoAccount.lastResetAt.toISOString().slice(0, 7) === month
      ? demoAccount.resetsThisMonth
      : 0;

  return {
    simulationsToday,
    aiCallsToday: usageToday?.calls ?? 0,
    aiCallsThisMonth: usageMonth._sum.calls ?? 0,
    portfolios,
    activeAlerts,
    balanceResetsThisMonth: resetsThisMonth,
  };
}

export interface LimitCheck {
  allowed: boolean;
  used: number;
  limit: number | null;
  message: string;
  upgradeTo: PlanId | null;
}

export async function checkSimulationLimit(userId: string, plan: PlanId): Promise<LimitCheck> {
  const e = entitlements(plan);
  if (e.simulationsPerDay == null) {
    return { allowed: true, used: 0, limit: null, message: '', upgradeTo: null };
  }
  const usage = await getUsage(userId);
  const allowed = usage.simulationsToday < e.simulationsPerDay;
  return {
    allowed,
    used: usage.simulationsToday,
    limit: e.simulationsPerDay,
    message: allowed
      ? ''
      : `Has alcanzado el límite de ${e.simulationsPerDay} simulaciones diarias del plan ${e.name}. El límite se reinicia a las 00:00 UTC.`,
    upgradeTo: allowed ? null : plan === 'FREE' ? 'STANDARD' : 'PREMIUM',
  };
}

export async function checkAILimit(userId: string, plan: PlanId): Promise<LimitCheck> {
  const e = entitlements(plan);
  const usage = await getUsage(userId);

  if (e.aiAnalysesPerDay != null) {
    const allowed = usage.aiCallsToday < e.aiAnalysesPerDay;
    return {
      allowed,
      used: usage.aiCallsToday,
      limit: e.aiAnalysesPerDay,
      message: allowed
        ? ''
        : `Has usado los ${e.aiAnalysesPerDay} análisis educativos diarios del plan ${e.name}. Se reinician a las 00:00 UTC.`,
      upgradeTo: allowed ? null : 'STANDARD',
    };
  }
  if (e.aiAnalysesPerMonth != null) {
    const allowed = usage.aiCallsThisMonth < e.aiAnalysesPerMonth;
    return {
      allowed,
      used: usage.aiCallsThisMonth,
      limit: e.aiAnalysesPerMonth,
      message: allowed
        ? ''
        : `Has usado los ${e.aiAnalysesPerMonth} análisis educativos mensuales del plan ${e.name}.`,
      upgradeTo: allowed || plan === 'PREMIUM' ? null : plan === 'FREE' ? 'STANDARD' : 'PREMIUM',
    };
  }
  return { allowed: true, used: 0, limit: null, message: '', upgradeTo: null };
}

export function assertSimulationMode(plan: PlanId, mode: SimulationMode): void {
  const e = entitlements(plan);
  if (!e.simulationModes.includes(mode)) {
    throw new ForbiddenError(
      `El modo de simulación seleccionado no está incluido en el plan ${e.name}. Está disponible a partir del plan Standard.`,
    );
  }
}

export function allowedIndicators(plan: PlanId): IndicatorId[] {
  return entitlements(plan).indicators;
}

export function filterIndicators(plan: PlanId, requested: string[]): IndicatorId[] {
  const allowed = new Set<string>(allowedIndicators(plan));
  return requested.filter((i): i is IndicatorId => allowed.has(i));
}

export function assetAllowed(plan: PlanId, minPlan: PlanId): boolean {
  return planAtLeast(plan, minPlan);
}

/** Historial consultable según el plan. */
export function historyCutoff(plan: PlanId): Date {
  const days = entitlements(plan).historyDays;
  return new Date(Date.now() - days * 86400000);
}

/** Latencia que debe declararse al usuario para su plan. */
export function declaredDelaySeconds(plan: PlanId): number {
  const planMax = entitlements(plan).maxDataDelaySeconds;
  const providerDelay = Number(process.env.MARKET_DATA_DELAY_SECONDS ?? '0');
  return Math.max(planMax === 0 ? providerDelay : planMax, providerDelay);
}
