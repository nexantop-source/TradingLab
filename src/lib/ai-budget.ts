import 'server-only';
import { db } from './db';

/**
 * Control de coste de inferencia.
 *
 * Cuando se alcanza el tope mensual configurado en `AI_MONTHLY_COST_CAP_USD`,
 * la plataforma no deja de funcionar: sirve el análisis educativo
 * determinístico e indica al usuario qué motor lo generó. Un tope de gasto no
 * debe traducirse en una funcionalidad rota.
 */

interface Snapshot {
  month: string;
  totalUsd: number;
  checkedAt: number;
}

let snapshot: Snapshot | null = null;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function monthlyCap(): number {
  return Number(process.env.AI_MONTHLY_COST_CAP_USD ?? '0');
}

export async function monthlyCostUsd(force = false): Promise<number> {
  const month = new Date().toISOString().slice(0, 7);
  const stale =
    !snapshot || snapshot.month !== month || Date.now() - snapshot.checkedAt > REFRESH_INTERVAL_MS;

  if (force || stale) {
    const agg = await db.aIUsage.aggregate({ where: { month }, _sum: { costUsd: true } });
    snapshot = { month, totalUsd: agg._sum.costUsd ?? 0, checkedAt: Date.now() };
  }
  return snapshot!.totalUsd;
}

export async function overBudget(): Promise<boolean> {
  const cap = monthlyCap();
  if (!cap) return false;
  return (await monthlyCostUsd()) >= cap;
}

/** Suma un coste al acumulado en memoria, evitando una consulta por llamada. */
export function addToSnapshot(costUsd: number): void {
  if (snapshot) snapshot.totalUsd += costUsd;
}
