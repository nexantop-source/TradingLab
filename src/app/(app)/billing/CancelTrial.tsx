'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@tl/ui';

/**
 * Cancelación de la prueba antes del primer cobro.
 *
 * Se pone donde se ve y con una sola confirmación. Esconder la cancelación es
 * la práctica que convierte una prueba gratuita en una trampa; aquí el objetivo
 * es que quien no quiera pagar no pague, y que quien se quede lo haga porque
 * quiere.
 */
export function CancelTrial({ daysLeft }: { daysLeft: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/billing/trial', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ reason: 'Cancelada desde Facturación durante la prueba.' }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result?.error?.message ?? 'No pudimos cancelar la renovación.');
        return;
      }
      router.refresh();
    } catch {
      setError('No pudimos contactar con el servidor. Inténtalo de nuevo.');
    } finally {
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <p>
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
          Cancelar antes del cobro
        </Button>
      </p>
    );
  }

  return (
    <div role="group" aria-label="Confirmar cancelación">
      <p>
        Al cancelar <strong>no se te cobrará nada</strong> y conservarás el acceso los {daysLeft}{' '}
        {daysLeft === 1 ? 'día' : 'días'} que te quedan de prueba. Después tu cuenta vuelve al plan gratuito.
      </p>
      {error && (
        <p role="alert" className="text-[var(--color-negative)]">
          {error}
        </p>
      )}
      <Button variant="negative" size="sm" loading={pending} onClick={cancel}>
        Sí, cancelar la renovación
      </Button>{' '}
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        Seguir con la prueba
      </Button>
    </div>
  );
}
