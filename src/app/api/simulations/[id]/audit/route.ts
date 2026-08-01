import { handleError, ok, fail } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import type { SimulationContextSnapshot } from '@tl/types';

/**
 * Traza completa de una simulación.
 *
 * Devuelve todo lo necesario para reconstruir y verificar el resultado meses
 * después: precios, procedencia, indicadores congelados, versión del motor y
 * la traza de cálculo del cierre.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth();
    const { id } = await ctx.params;

    const sim = await db.simulation.findFirst({ where: { id, userId: user.id } });
    if (!sim) return fail('NOT_FOUND', 'No se ha encontrado la simulación indicada.', 404);

    const context = fromJson<SimulationContextSnapshot | null>(sim.contextSnapshot, null);

    return ok({
      id: sim.id,
      engineVersion: sim.engineVersion,
      mode: sim.mode,
      symbol: sim.symbol,
      direction: sim.direction,
      entry: {
        price: sim.entryPrice,
        provider: sim.priceSourceProvider,
        sourceTimestamp: sim.priceSourceTimestamp.toISOString(),
        latencyMs: sim.entryLatencyMs,
      },
      exit: sim.exitPrice
        ? {
            price: sim.exitPrice,
            provider: sim.exitSourceProvider,
            sourceTimestamp: sim.exitSourceTimestamp?.toISOString() ?? null,
            latencyMs: sim.exitLatencyMs,
          }
        : null,
      amounts: {
        stakeCents: sim.stakeCents,
        feeCents: sim.feeCents,
        pnlCents: sim.pnlCents,
        leverage: sim.leverage,
        quantity: sim.quantity,
      },
      levels: { stopLoss: sim.stopLoss, takeProfit: sim.takeProfit, trailing: sim.trailingStopDistance },
      timing: {
        openedAt: sim.openedAt.toISOString(),
        expiresAt: sim.expiresAt?.toISOString() ?? null,
        closedAt: sim.closedAt?.toISOString() ?? null,
        userTimezone: sim.userTimezone,
      },
      declaration: {
        rationale: sim.rationale,
        confidence: sim.confidence,
        perceivedRisk: sim.perceivedRisk,
      },
      context,
      settlementAudit: fromJson<string[]>(sim.settlementAudit, []),
      ledger: await db.demoBalanceLedger.findMany({
        where: { reference: sim.id },
        orderBy: { createdAt: 'asc' },
        select: { amountCents: true, balanceAfterCents: true, reason: true, memo: true, createdAt: true },
      }),
    });
  } catch (error) {
    return handleError(error);
  }
}
