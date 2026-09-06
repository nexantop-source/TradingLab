'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Field, Textarea } from '@tl/ui';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
import type { PlanId } from '@tl/types';

export interface ActiveGrant {
  userId: string;
  email: string;
  name: string;
  planId: string;
  currentPeriodEnd: string;
  grantedAt: string | null;
  grantedReason: string | null;
  grantedByName: string | null;
}

/** Cortesías vigentes y su retirada. Solo actúa sobre suscripciones regaladas. */
export function ActiveGrants({ grants, canWrite }: { grants: ActiveGrant[]; canWrite: boolean }) {
  const router = useRouter();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke(userId: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/subscriptions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ userId, reason }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result?.error?.message ?? 'No pudimos retirar la cortesía.');
        return;
      }
      setRevoking(null);
      setReason('');
      router.refresh();
    } catch {
      setError('No pudimos contactar con el servidor.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <div className="border-b border-[var(--color-border)] px-5 py-3.5">
        <h2 className="text-[length:var(--text-md)] font-semibold">Cortesías vigentes</h2>
        <p className="mt-1 text-[length:var(--text-2xs)] text-[var(--color-muted)]">
          Suscripciones concedidas sin cobro. No aparecen en el valor mensualizado.
        </p>
      </div>

      {grants.length === 0 ? (
        <p className="px-5 py-6 text-[length:var(--text-xs)] text-[var(--color-muted)]">
          No hay ninguna suscripción de cortesía activa.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {grants.map((grant) => (
            <li key={grant.userId} className="px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[length:var(--text-xs)] font-medium">{grant.name}</span>
                  <span className="num block truncate text-[length:var(--text-2xs)] text-[var(--color-muted)]">
                    {grant.email}
                  </span>
                </span>
                <Badge tone="positive">{PLAN_ENTITLEMENTS[grant.planId as PlanId]?.name ?? grant.planId}</Badge>
                <span className="num text-[length:var(--text-2xs)] text-[var(--color-muted)]">
                  hasta {new Date(grant.currentPeriodEnd).toLocaleDateString('es')}
                </span>
                {canWrite && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRevoking(revoking === grant.userId ? null : grant.userId);
                      setReason('');
                      setError(null);
                    }}
                    aria-expanded={revoking === grant.userId}
                  >
                    {revoking === grant.userId ? 'Cancelar' : 'Retirar'}
                  </Button>
                )}
              </div>

              {grant.grantedReason && (
                <p className="mt-1.5 text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-subtle)]">
                  «{grant.grantedReason}»{grant.grantedByName ? ` — ${grant.grantedByName}` : ''}
                </p>
              )}

              {revoking === grant.userId && (
                <div className="mt-3 space-y-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-overlay)] p-3.5">
                  <Field label="Motivo de la retirada" htmlFor={`revoke-${grant.userId}`} required>
                    <Textarea
                      id={`revoke-${grant.userId}`}
                      rows={2}
                      maxLength={300}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="La incidencia que motivó la cortesía quedó resuelta."
                    />
                  </Field>
                  {error && (
                    <p role="alert" className="text-[length:var(--text-2xs)] text-[var(--color-negative)]">
                      {error}
                    </p>
                  )}
                  <p className="text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-muted)]">
                    {grant.name} volverá a Explore de inmediato y perderá el acceso a las funciones del plan.
                  </p>
                  <Button
                    size="sm"
                    variant="negative"
                    loading={pending}
                    disabled={reason.trim().length < 4}
                    onClick={() => revoke(grant.userId)}
                  >
                    Retirar la cortesía
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
