'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input, Callout } from '@tl/ui';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import { checkoutPath, onboardingPath, type CheckoutIntent } from '@/lib/checkout-intent';

export function LoginForm({ intent = null }: { intent?: CheckoutIntent | null }) {
  const router = useRouter();
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
      const next = intent
        ? result.next === '/onboarding'
          ? onboardingPath(intent)
          : checkoutPath(intent)
        : result.next;
      router.push(next);
      router.refresh();
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
          autoComplete="email"
          required
          placeholder="tu@correo.com"
        />
      </Field>

      <Field label="Contraseña" htmlFor="password" error={fieldErrors.password} required>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
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
