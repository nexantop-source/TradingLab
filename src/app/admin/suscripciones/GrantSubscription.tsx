'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Search, TriangleAlert, Check, X } from 'lucide-react';
import { Badge, Button, Card, Field, Input, Select, Textarea } from '@tl/ui';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';

interface FoundUser {
  id: string;
  email: string;
  name: string;
  status: string;
  createdAt: string;
  activePlan: 'FREE' | 'STANDARD' | 'PREMIUM';
  subscriptionSource: string | null;
  currentPeriodEnd: string | null;
}

const DURATIONS = [
  { days: 7, label: '7 días' },
  { days: 30, label: '1 mes' },
  { days: 90, label: '3 meses' },
  { days: 180, label: '6 meses' },
  { days: 365, label: '1 año' },
];

/**
 * Concesión de suscripciones de cortesía.
 *
 * Se busca a la persona antes de conceder nada: escribir un correo a mano y
 * pulsar «regalar» permite equivocarse de destinatario sin enterarse. Aquí el
 * plan vigente y la antigüedad de la cuenta se ven antes de confirmar.
 */
export function GrantSubscription({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoundUser | null>(null);

  const [plan, setPlan] = useState<'STANDARD' | 'PREMIUM'>('PREMIUM');
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; plan: string; until: string } | null>(null);

  // Búsqueda con retardo: una petición por pausa de escritura, no por tecla.
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      setSearching(true);
      try {
        const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query.trim())}`, {
          signal: request.signal,
          credentials: 'same-origin',
        });
        const result = await response.json();
        if (result.ok) setResults(result.data.users);
      } catch {
        /* Una búsqueda cancelada o fallida no es un error que mostrar. */
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selected]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/subscriptions/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: selected.email, plan, days, reason }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result?.error?.message ?? 'No pudimos conceder la suscripción.');
        return;
      }
      setDone({
        email: result.data.email,
        plan: PLAN_ENTITLEMENTS[plan as 'STANDARD' | 'PREMIUM'].name,
        until: new Date(result.data.currentPeriodEnd).toLocaleDateString('es'),
      });
      setSelected(null);
      setQuery('');
      setReason('');
      router.refresh();
    } catch {
      setError('No pudimos contactar con el servidor. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!canWrite) return null;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-2.5">
        <Gift size={18} className="mt-0.5 shrink-0 text-[var(--color-blue)]" aria-hidden="true" />
        <div>
          <h2 className="text-[length:var(--text-md)] font-semibold">Regalar una suscripción</h2>
          <p className="mt-1 text-[length:var(--text-xs)] leading-relaxed text-[var(--color-muted)]">
            Concede acceso completo sin cobro. No genera ningún pago, no computa en el valor
            mensualizado y no se renueva sola: al vencer, la cuenta vuelve a Explore. Queda
            registrada en la auditoría con tu nombre y el motivo.
          </p>
        </div>
      </div>

      {done && (
        <div
          role="status"
          className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-positive)_28%,transparent)] bg-[var(--color-positive-soft)] p-3"
        >
          <Check size={15} className="mt-0.5 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
          <p className="text-[length:var(--text-xs)] leading-relaxed">
            <strong>{done.plan}</strong> activado para <span className="num">{done.email}</span> hasta el{' '}
            <span className="num">{done.until}</span>. Le hemos enviado un aviso dentro de la app.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="mt-4 space-y-4">
        <Field
          label="Cuenta destinataria"
          htmlFor={searchId}
          required
          hint="Busca por correo o nombre. Solo aparecen cuentas registradas."
        >
          <div className="relative">
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-subtle)]"
            />
            <Input
              id={searchId}
              type="search"
              autoComplete="off"
              className="pl-10"
              placeholder="nombre@correo.com"
              value={selected ? `${selected.name} · ${selected.email}` : query}
              onChange={(event) => {
                setSelected(null);
                setQuery(event.target.value);
              }}
            />
          </div>
        </Field>

        {!selected && results.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
            {results.map((found) => (
              <li key={found.id}>
                <button
                  type="button"
                  onClick={() => setSelected(found)}
                  className="flex w-full min-h-11 items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--color-overlay)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[length:var(--text-xs)] font-medium">{found.name}</span>
                    <span className="num block truncate text-[length:var(--text-2xs)] text-[var(--color-muted)]">
                      {found.email}
                    </span>
                  </span>
                  <Badge tone={found.activePlan === 'FREE' ? 'neutral' : 'positive'}>
                    {PLAN_ENTITLEMENTS[found.activePlan].name}
                  </Badge>
                  {found.status !== 'ACTIVE' && <Badge tone="gold">{found.status}</Badge>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!selected && searching && (
          <p className="text-[length:var(--text-2xs)] text-[var(--color-subtle)]">Buscando…</p>
        )}
        {!selected && !searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="text-[length:var(--text-2xs)] text-[var(--color-subtle)]">
            Ninguna cuenta coincide con «{query.trim()}».
          </p>
        )}

        {selected && selected.activePlan !== 'FREE' && (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-gold)_28%,transparent)] bg-[var(--color-gold-soft)] p-3">
            <TriangleAlert size={15} className="mt-0.5 shrink-0 text-[var(--color-gold)]" aria-hidden="true" />
            <p className="text-[length:var(--text-2xs)] leading-relaxed">
              Esta cuenta ya tiene <strong>{PLAN_ENTITLEMENTS[selected.activePlan].name}</strong>
              {selected.subscriptionSource === 'GRANT'
                ? ' por cortesía. La nueva concesión sustituirá a la anterior.'
                : ' por pago. No se puede conceder una cortesía encima de una suscripción de pago vigente.'}
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan" htmlFor="grant-plan" required>
            <Select
              id="grant-plan"
              value={plan}
              onChange={(event) => setPlan(event.target.value as 'STANDARD' | 'PREMIUM')}
            >
              <option value="STANDARD">{PLAN_ENTITLEMENTS.STANDARD.name}</option>
              <option value="PREMIUM">{PLAN_ENTITLEMENTS.PREMIUM.name}</option>
            </Select>
          </Field>

          <Field label="Duración" htmlFor="grant-days" required>
            <Select id="grant-days" value={days} onChange={(event) => setDays(Number(event.target.value))}>
              {DURATIONS.map((option) => (
                <option key={option.days} value={option.days}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Motivo"
          htmlFor="grant-reason"
          required
          hint="Queda en la auditoría. Una cortesía sin razón declarada no se puede justificar después."
        >
          <Textarea
            id="grant-reason"
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Compensación por incidencia de facturación del 3 de septiembre."
          />
        </Field>

        {error && (
          <p role="alert" className="flex items-start gap-2 text-[length:var(--text-xs)] text-[var(--color-negative)]">
            <X size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <Button type="submit" loading={submitting} disabled={!selected || reason.trim().length < 4}>
          {selected ? `Conceder a ${selected.name}` : 'Elige una cuenta'}
        </Button>
      </form>
    </Card>
  );
}
