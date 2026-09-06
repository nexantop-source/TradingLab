import 'server-only';
import { db } from './db';
import { INITIAL_DEMO_BALANCE_CENTS, type LedgerReason, type PlanId } from '@tl/types';
import { entitlements } from '@tl/types/plans';
import { LedgerError } from '@tl/simulation-engine';
import { Prisma } from '@prisma/client';

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
  return demoTransaction(async (tx) => {
    // The principal account has no unique userId (multiple named accounts are
    // supported). Serialize its first creation on the existing user row.
    await tx.user.update({ where: { id: userId }, data: { updatedAt: new Date() } });
    const raced = await tx.demoAccount.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
    if (raced) return raced;
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
  return postMany(params.demoAccountId, [params]);
}

/** Varios asientos en una sola transacción, en orden. */
export async function postMany(demoAccountId: string, posts: Omit<PostParams, 'demoAccountId'>[]): Promise<number> {
  return demoTransaction(tx => postManyInTransaction(tx, demoAccountId, posts));
}

/** Shares the caller's transaction: position changes and ledger entries commit
 * together. A stale balance aborts the complete operation, never a lost update.
 */
export async function postManyInTransaction(tx: Prisma.TransactionClient, demoAccountId: string, posts: Omit<PostParams, 'demoAccountId'>[]): Promise<number> {
  const account = await tx.demoAccount.findUnique({ where: { id: demoAccountId } });
  if (!account) throw new LedgerError('La cuenta DEMO indicada no existe.', 'INTEGRITY');

  let balance = account.balanceCents;
  const entries: Array<{ post: Omit<PostParams, 'demoAccountId'>; balance: number }> = [];
  for (const p of posts) {
    if (!Number.isSafeInteger(p.amountCents)) throw new LedgerError('El asiento debe expresarse en centavos enteros.', 'INTEGRITY');
    balance += p.amountCents;
    if (balance < 0) {
      throw new LedgerError(
        'Tu saldo virtual no es suficiente para esta operación.',
        'INSUFFICIENT_VIRTUAL_BALANCE',
      );
    }
    if (!Number.isSafeInteger(balance) || balance > 2_147_483_647) throw new LedgerError('El asiento supera el saldo virtual admitido.', 'INTEGRITY');
    entries.push({ post: p, balance });
  }
  const claimed = await tx.demoAccount.updateMany({
    where: { id: demoAccountId, balanceCents: account.balanceCents, updatedAt: account.updatedAt },
    data: { balanceCents: balance },
  });
  if (claimed.count !== 1) throw balanceConflict();
  for (const entry of entries) {
    const p = entry.post;
    await tx.demoBalanceLedger.create({
      data: {
        demoAccountId,
        amountCents: p.amountCents,
        balanceAfterCents: entry.balance,
        reason: p.reason,
        reference: p.reference ?? null,
        memo: p.memo ?? null,
      },
    });
  }
  return balance;
}

function balanceConflict() {
  return new LedgerError('Tu saldo virtual cambió mientras se procesaba la operación. Actualiza la cuenta e inténtalo de nuevo.', 'INTEGRITY');
}

/** Do not retry user operations implicitly: a fresh explicit retry gets a new
 * quote. DB write conflicts roll back and become a controlled domain error.
 */
export async function demoTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try { return await db.$transaction(operation); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2028', 'P1008'].includes(error.code)) throw balanceConflict();
    throw error;
  }
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

  const balance = await demoTransaction(async (tx) => {
    // Claim the account before checking positions, so concurrent opens cannot
    // slip between the eligibility check and the balance reset.
    const claimed = await tx.demoAccount.updateMany({
      where: { id: account.id, balanceCents: account.balanceCents, updatedAt: account.updatedAt, resetsThisMonth: account.resetsThisMonth, lastResetAt: account.lastResetAt },
      data: { balanceCents: INITIAL_DEMO_BALANCE_CENTS, resetsThisMonth: used + 1, lastResetAt: new Date() },
    });
    if (claimed.count !== 1) throw balanceConflict();
    if (await tx.simulation.count({ where: { userId, status: 'OPEN' } })) {
      throw new LedgerError('Cierra tus simulaciones abiertas antes de reiniciar el saldo virtual.', 'INTEGRITY');
    }
    await tx.demoBalanceLedger.create({
      data: {
        demoAccountId: account.id,
        amountCents: INITIAL_DEMO_BALANCE_CENTS - account.balanceCents,
        balanceAfterCents: INITIAL_DEMO_BALANCE_CENTS,
        reason: 'BALANCE_RESET' satisfies LedgerReason,
        memo: `Reinicio solicitado por el estudiante. Saldo anterior: ${(account.balanceCents / 100).toFixed(2)} VUSD.`,
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
