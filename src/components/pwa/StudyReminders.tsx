'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button, Field, Select } from '@tl/ui';

/**
 * Recordatorio diario de estudio.
 *
 * El permiso del navegador se pide **solo** tras un gesto explícito y después
 * de explicar para qué sirve: un aviso lanzado al cargar la página se deniega
 * por reflejo, y una denegación es prácticamente irreversible sin entrar en la
 * configuración del sistema.
 *
 * El recordatorio es lo único que se envía. No hay avisos de precio ni de
 * mercado: esta es una plataforma educativa y una notificación que empuje a no
 * perderse un movimiento trabajaría contra su propósito.
 */
export function StudyReminders({
  initialOptIn,
  initialHour,
  timezone,
}: {
  initialOptIn: boolean;
  initialHour: number;
  timezone: string;
}) {
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [optIn, setOptIn] = useState(initialOptIn);
  const [hour, setHour] = useState(initialHour);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    fetch('/api/push/subscribe', { credentials: 'same-origin' })
      .then((response) => response.json())
      .then((result) => setAvailable(Boolean(result?.ok && result.data.configured)))
      .catch(() => setAvailable(false));
  }, []);

  async function savePreference(next: { studyReminderOptIn?: boolean; studyReminderHour?: number }) {
    await fetch('/api/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(next),
    });
  }

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== 'granted') {
        setError(
          granted === 'denied'
            ? 'Tu navegador tiene bloqueadas las notificaciones para TradingLab. Puedes reactivarlas desde los ajustes del sitio.'
            : 'No se concedió el permiso.',
        );
        return;
      }

      const keyResponse = await fetch('/api/push/subscribe', { credentials: 'same-origin' });
      const keyResult = await keyResponse.json();
      if (!keyResult?.ok || !keyResult.data.publicKey) {
        setError('Las notificaciones no están disponibles en esta instalación.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyResult.data.publicKey,
      });

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        setError('No pudimos registrar este dispositivo.');
        return;
      }

      await savePreference({ studyReminderOptIn: true, studyReminderHour: hour });
      setOptIn(true);
    } catch {
      setError('No pudimos activar los recordatorios en este dispositivo.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        }).catch(() => null);
        await subscription.unsubscribe().catch(() => null);
      }
      await savePreference({ studyReminderOptIn: false });
      setOptIn(false);
    } finally {
      setBusy(false);
    }
  }

  if (!supported || available === false) {
    return (
      <p className="text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-subtle)]">
        Los recordatorios no están disponibles en este navegador. En iPhone requieren que añadas TradingLab a la
        pantalla de inicio.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-overlay)]"
          aria-hidden="true"
        >
          {optIn ? (
            <Bell size={16} className="text-[var(--color-blue)]" />
          ) : (
            <BellOff size={16} className="text-[var(--color-subtle)]" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--text-xs)] font-medium">
            {optIn ? 'Recordatorio diario activo' : 'Recordatorio diario de estudio'}
          </p>
          <p className="mt-0.5 text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-muted)]">
            Un aviso al día para no perder la constancia, y solo si hoy no has estudiado. Nunca enviamos alertas de
            precio ni avisos que inviten a operar por impulso.
          </p>
        </div>
        <Button
          size="sm"
          variant={optIn ? 'outline' : 'primary'}
          loading={busy}
          onClick={optIn ? disable : enable}
          disabled={permission === 'denied' && !optIn}
        >
          {optIn ? 'Desactivar' : 'Activar'}
        </Button>
      </div>

      {optIn && (
        <Field
          label="Hora del recordatorio"
          htmlFor="reminder-hour"
          hint={`En tu zona horaria declarada (${timezone}).`}
        >
          <Select
            id="reminder-hour"
            value={hour}
            onChange={(event) => {
              const next = Number(event.target.value);
              setHour(next);
              void savePreference({ studyReminderHour: next });
            }}
          >
            {Array.from({ length: 24 }, (_, index) => (
              <option key={index} value={index}>
                {String(index).padStart(2, '0')}:00
              </option>
            ))}
          </Select>
        </Field>
      )}

      {error && (
        <p role="alert" className="text-[length:var(--text-2xs)] text-[var(--color-negative)]">
          {error}
        </p>
      )}
    </div>
  );
}
