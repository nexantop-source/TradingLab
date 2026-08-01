import 'server-only';
import { db } from './db';
import { INITIAL_DEMO_BALANCE_CENTS, type LedgerReason, type PlanId } from '@tl/types';
import { entitlements } from '@tl/types/plans';
import { LedgerError } from '@tl/simulation-engine';

/**
 * Servicio de la cuenta DEMO.
 *
 * Única vía para mover el saldo virtual. Cualquier otro módulo que necesite
 * modificarlo llama a `post`, que escribe el asiento y actualiza el saldo en
 * la misma transacción.
 */

export async function ensureDemoAccount(userId: string) {
  const existing = await db.demoAccount.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
  if (existing) return existing;

  // Crea la cuenta y su asiento de apertura de forma atómica.
  return db.$transaction(async (tx) => {
    const account = await tx.demoAccount.create({
      data: { userId, balanceCents: INITIAL_DEMO_BALANCE_CENTS },
    });
    await tx.demoBalanceLedger.create({
      data: {
        demoAccountId: account.id,
        amountCents: INITIAL_DEMO_BALANCE_CENTS,
        balanceAfterCents: INITIAL_DEMO_BALANCE_CENTS,
        reason: 'ACCOUNT_OPENING' satisfies LedgerReason,
        memo: 'Saldo virtual inicial de USD 10.000. No es dinero real y no puede retirarse.',
      },
    });
    return account;
  });
}

export interface PostParams {
  demoAccountId: string;
  amountCents: number;
  reason: LedgerReason;
  reference?: string | null;
  memo?: string | null;
}

/**
 * Registra un asiento. Devuelve el saldo resultante.
 * Se ejecuta dentro de una transacción para que saldo y asiento nunca
 * diverjan.
 */
export async function post(params: PostParams): Promise<number> {
  return db.$transaction(async (tx) => {
    const account = await tx.demoAccount.findUnique({ where: { id: params.demoAccountId } });
    if (!account) throw new LedgerError('La cuenta DEMO indicada no existe.', 'INTEGRITY');

    const next = account.balanceCents + params.amountCents;
    if (next < 0) {
      throw new LedgerError(
        'Tu saldo virtual no es suficiente para esta simulación. Reduce el monto o reinicia el saldo desde tu perfil.',
        'INSUFFICIENT_VIRTUAL_BALANCE',
      );
    }

    await tx.demoBalanceLedger.create({
      data: {
        demoAccountId: params.demoAccountId,
        amountCents: params.amountCents,
        balanceAfterCents: next,
        reason: params.reason,
        reference: params.reference ?? null,
        memo: params.memo ?? null,
      },
    });
    await tx.demoAccount.update({
      where: { id: params.demoAccountId },
      data: { balanceCents: next },
    });
    return next;
  });
}

/** Varios asientos en una sola transacción, en orden. */
export async function postMany(demoAccountId: string, posts: Omit<PostParams, 'demoAccountId'>[]): Promise<number> {
  return db.$transaction(async (tx) => {
    const account = await tx.demoAccount.findUnique({ where: { id: demoAccountId } });
    if (!account) throw new LedgerError('La cuenta DEMO indicada no existe.', 'INTEGRITY');

    let balance = account.balanceCents;
    for (const p of posts) {
      balance += p.amountCents;
      if (balance < 0) {
        throw new LedgerError(
          'Tu saldo virtual no es suficiente para esta operación.',
          'INSUFFICIENT_VIRTUAL_BALANCE',
        );
      }
      await tx.demoBalanceLedger.create({
        data: {
          demoAccountId,
          amountCents: p.amountCents,
          balanceAfterCents: balance,
          reason: p.reason,
          reference: p.reference ?? null,
          memo: p.memo ?? null,
        },
      });
    }
    await tx.demoAccount.update({ where: { id: demoAccountId }, data: { balanceCents: balance } });
    return balance;
  });
}

export interface ResetResult {
  balanceCents: number;
  resetsUsed: number;
  resetsAllowed: number;
}

/**
 * Reinicio del saldo virtual.
 * Está limitado por plan y queda registrado en el libro mayor: nunca se borra
 * el historial, se añade el asiento de corrección.
 */
export async function resetBalance(userId: string, plan: PlanId): Promise<ResetResult> {
  const account = await ensureDemoAccount(userId);
  const allowed = entitlements(plan).balanceResetsPerMonth;
  const month = new Date().toISOString().slice(0, 7);
  const sameMonth = account.lastResetAt?.toISOString().slice(0, 7) === month;
  const used = sameMonth ? account.resetsThisMonth : 0;

  if (used >= allowed) {
    throw new LedgerError(
      `Has usado los ${allowed} reinicios de saldo que incluye tu plan este mes. El contador se renueva el día 1.`,
      'INTEGRITY',
    );
  }

  const openSims = await db.simulation.count({ where: { userId, status: 'OPEN' } });
  if (openSims > 0) {
    throw new LedgerError(
      `Tienes ${openSims} simulación(es) abierta(s). Ciérralas antes de reiniciar el saldo virtual.`,
      'INTEGRITY',
    );
  }

  const delta = INITIAL_DEMO_BALANCE_CENTS - account.balanceCents;

  const balance = await db.$transaction(async (tx) => {
    await tx.demoBalanceLedger.create({
      data: {
        demoAccountId: account.id,
        amountCents: delta,
        balanceAfterCents: INITIAL_DEMO_BALANCE_CENTS,
        reason: 'BALANCE_RESET' satisfies LedgerReason,
        memo: `Reinicio solicitado por el estudiante. Saldo anterior: ${(account.balanceCents / 100).toFixed(2)} VUSD.`,
      },
    });
    await tx.demoAccount.update({
      where: { id: account.id },
      data: {
        balanceCents: INITIAL_DEMO_BALANCE_CENTS,
        resetsThisMonth: used + 1,
        lastResetAt: new Date(),
      },
    });
    return INITIAL_DEMO_BALANCE_CENTS;
  });

  return { balanceCents: balance, resetsUsed: used + 1, resetsAllowed: allowed };
}

/** Variación del saldo en las últimas 24 horas, para el panel. */
export async function dailyChangeCents(demoAccountId: string): Promise<number> {
  const since = new Date(Date.now() - 86400000);
  const rows = await db.demoBalanceLedger.findMany({
    where: { demoAccountId, createdAt: { gte: since }, reason: { in: ['SIMULATION_SETTLEMENT', 'SIMULATION_FEE'] } },
    select: { amountCents: true },
  });
  return rows.reduce((a, r) => a + r.amountCents, 0);
}
