'use client';

import * as React from 'react';
import { Button, Field, Input, Callout } from '@tl/ui';
import { PasswordInput } from '@/components/pwa/PasswordInput';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import { postLoginPath, type CheckoutIntent } from '@/lib/checkout-intent';

export function LoginForm({ intent = null }: { intent?: CheckoutIntent | null }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const data = new FormData(e.currentTarget);

    try {
      const result = await apiFetch<{ next: string }>('/api/auth/login', {
        method: 'POST',
        json: {
          email: String(data.get('email') ?? ''),
          password: String(data.get('password') ?? ''),
        },
      });
      // A new session needs a fresh document, not a race between an anonymous
      // Router Cache navigation and refresh (notably on installed iOS PWAs).
      window.location.replace(postLoginPath(result.next, intent));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors());
      } else {
        setError('No hemos podido conectar con el servidor. Comprueba tu conexión.');
      }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {error && (
        <Callout tone="danger" title="No se ha podido iniciar sesión">
          {error}
        </Callout>
      )}

      <Field label="Correo electrónico" htmlFor="email" error={fieldErrors.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="email"
          required
          placeholder="tu@correo.com"
        />
      </Field>

      <Field label="Contraseña" htmlFor="password" error={fieldErrors.password} required>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>

      <Button type="submit" fullWidth size="lg" loading={loading}>
        Entrar
      </Button>

      <p className="text-center text-[12px] text-[var(--color-subtle)]">
        Al iniciar sesión aceptas los términos vigentes y confirmas que entiendes que TradingLab es una
        plataforma educativa y de simulación.
      </p>
    </form>
  );
}
