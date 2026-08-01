import type { LedgerReason } from '@tl/types';

/**
 * Libro mayor virtual.
 *
 * Regla no negociable: el saldo DEMO **nunca** se modifica directamente. Todo
 * cambio es un asiento con motivo, referencia y saldo resultante. El saldo de
 * la cuenta es siempre la suma de sus asientos, y `verifyLedger` lo comprueba.
 */

export interface LedgerPost {
  amountCents: number;
  reason: LedgerReason;
  reference: string | null;
  memo: string | null;
}

export interface LedgerRow {
  amountCents: number;
  balanceAfterCents: number;
  reason: LedgerReason;
  createdAt: Date | string;
}

/** Aplica un asiento sobre un saldo y devuelve el nuevo estado. */
export function applyPost(currentBalanceCents: number, post: LedgerPost): {
  balanceAfterCents: number;
  post: LedgerPost;
} {
  const next = currentBalanceCents + post.amountCents;
  if (next < 0) {
    throw new LedgerError(
      'El asiento dejaría el saldo virtual en negativo. La operación no se registra.',
      'INSUFFICIENT_VIRTUAL_BALANCE',
    );
  }
  return { balanceAfterCents: next, post };
}

/**
 * Verificación de integridad usada por el panel administrativo y por las
 * pruebas: recalcula el saldo desde cero y compara.
 */
export function verifyLedger(rows: LedgerRow[]): {
  ok: boolean;
  computedBalanceCents: number;
  storedBalanceCents: number | null;
  firstDivergenceIndex: number | null;
} {
  let balance = 0;
  let firstDivergence: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    balance += rows[i].amountCents;
    if (rows[i].balanceAfterCents !== balance && firstDivergence === null) {
      firstDivergence = i;
    }
  }
  const stored = rows.length ? rows[rows.length - 1].balanceAfterCents : null;
  return {
    ok: firstDivergence === null,
    computedBalanceCents: balance,
    storedBalanceCents: stored,
    firstDivergenceIndex: firstDivergence,
  };
}

export class LedgerError extends Error {
  constructor(message: string, readonly code: 'INSUFFICIENT_VIRTUAL_BALANCE' | 'INTEGRITY') {
    super(message);
    this.name = 'LedgerError';
  }
}

export const LEDGER_REASON_LABEL: Record<LedgerReason, string> = {
  ACCOUNT_OPENING: 'Apertura de cuenta DEMO',
  SIMULATION_MARGIN_HOLD: 'Retención de margen virtual',
  SIMULATION_MARGIN_RELEASE: 'Liberación de margen virtual',
  SIMULATION_SETTLEMENT: 'Liquidación de simulación',
  SIMULATION_FEE: 'Comisión o spread virtual',
  BALANCE_RESET: 'Reinicio de saldo virtual',
  ADMIN_ADJUSTMENT: 'Ajuste administrativo auditado',
  CHALLENGE_REWARD: 'Reconocimiento por reto educativo',
};
