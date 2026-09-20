'use client';

import * as React from 'react';
import { Button, Field, Input, Callout } from '@tl/ui';
import { PasswordInput } from '@/components/pwa/PasswordInput';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import { postLoginPath, type CheckoutIntent } from '@/lib/checkout-intent';
import { loginSchema } from '@/lib/validation';

export function LoginForm({ intent = null }: { intent?: CheckoutIntent | null }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const submitting = React.useRef(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    const name = Object.keys(fieldErrors)[0];
    if (name) (formRef.current?.elements.namedItem(name) as HTMLElement | null)?.focus();
  }, [fieldErrors]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    setError(null);
    setFieldErrors({});

    const data = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: data.get('email'), password: data.get('password') });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([name, messages]) => [name, messages?.[0] ?? 'Revisa este campo.'])));
      return;
    }
    submitting.current = true;
    setLoading(true);

    try {
      const result = await apiFetch<{ next: string }>('/api/auth/login', {
        method: 'POST',
        json: parsed.data,
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
      submitting.current = false;
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="auth-form" noValidate aria-busy={loading}>
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
        Iniciar sesión
      </Button>

      <p className="text-center text-[12px] text-[var(--color-subtle)]">
        Tu cuenta, tus lecciones y tus prácticas en un solo lugar.
      </p>
    </form>
  );
}
