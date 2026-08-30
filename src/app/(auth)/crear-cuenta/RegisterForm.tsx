'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Callout, Checkbox, Field, Input, Select } from '@tl/ui';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import { onboardingPath, type CheckoutIntent } from '@/lib/checkout-intent';

/** Países con mayor presencia hispanohablante, más una entrada libre. */
const COUNTRIES = [
  { code: 'ES', name: 'España' },
  { code: 'MX', name: 'México' },
  { code: 'CO', name: 'Colombia' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'PE', name: 'Perú' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'DO', name: 'República Dominicana' },
  { code: 'HN', name: 'Honduras' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'PA', name: 'Panamá' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'OT', name: 'Otro país' },
];

export function RegisterForm({ intent = null }: { intent?: CheckoutIntent | null }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [timezone, setTimezone] = React.useState('UTC');

  React.useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    } catch {
      setTimezone('UTC');
    }
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const data = new FormData(e.currentTarget);

    try {
      await apiFetch<{ next: string }>('/api/auth/register', {
        method: 'POST',
        json: {
          name: String(data.get('name') ?? ''),
          email: String(data.get('email') ?? ''),
          password: String(data.get('password') ?? ''),
          countryCode: String(data.get('countryCode') ?? 'ES'),
          timezone,
          locale: 'es',
          acceptTerms: data.get('acceptTerms') === 'on',
          acceptRisk: data.get('acceptRisk') === 'on',
          confirmAge: data.get('confirmAge') === 'on',
          marketingOptIn: data.get('marketingOptIn') === 'on',
        },
      });
      router.push(onboardingPath(intent));
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
        <Callout tone="danger" title="No se ha podido crear la cuenta">
          {error}
        </Callout>
      )}

      <Field label="Nombre" htmlFor="name" error={fieldErrors.name} required>
        <Input id="name" name="name" autoComplete="name" required placeholder="Cómo quieres que te llamemos" />
      </Field>

      <Field label="Correo electrónico" htmlFor="email" error={fieldErrors.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="tu@correo.com" />
      </Field>

      <Field
        label="Contraseña"
        htmlFor="password"
        hint="Al menos 10 caracteres. Una frase que recuerdes es más segura que una palabra con símbolos."
        error={fieldErrors.password}
        required
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>

      <Field
        label="País de residencia"
        htmlFor="countryCode"
        hint={`Zona horaria detectada: ${timezone}. Podrás cambiarla desde tu perfil.`}
        error={fieldErrors.countryCode}
        required
      >
        <Select id="countryCode" name="countryCode" defaultValue="ES" required>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <Checkbox
          name="confirmAge"
          required
          label="Confirmo que tengo la mayoría de edad según la legislación de mi país de residencia."
        />
        <Checkbox
          name="acceptTerms"
          required
          label={
            <>
              He leído y acepto los{' '}
              <Link href="/legal/terminos" target="_blank" className="text-[var(--color-blue)] hover:underline">
                términos y condiciones
              </Link>{' '}
              y la{' '}
              <Link href="/legal/privacidad" target="_blank" className="text-[var(--color-blue)] hover:underline">
                política de privacidad
              </Link>
              .
            </>
          }
        />
        <Checkbox
          name="acceptRisk"
          required
          label={
            <>
              Entiendo que TradingLab es una plataforma educativa y de simulación: no es un broker regulado, no
              admite depósitos y el saldo virtual no puede retirarse. He leído la{' '}
              <Link href="/legal/riesgo" target="_blank" className="text-[var(--color-blue)] hover:underline">
                advertencia de riesgo
              </Link>
              .
            </>
          }
        />
        <Checkbox
          name="marketingOptIn"
          label="Quiero recibir contenido educativo por correo."
          description="Opcional. Puedes darte de baja en cualquier momento desde tu perfil."
        />
      </div>

      {fieldErrors.acceptTerms && (
        <p role="alert" className="text-xs text-[var(--color-negative)]">
          {fieldErrors.acceptTerms}
        </p>
      )}
      {fieldErrors.acceptRisk && (
        <p role="alert" className="text-xs text-[var(--color-negative)]">
          {fieldErrors.acceptRisk}
        </p>
      )}
      {fieldErrors.confirmAge && (
        <p role="alert" className="text-xs text-[var(--color-negative)]">
          {fieldErrors.confirmAge}
        </p>
      )}

      <Button type="submit" fullWidth size="lg" loading={loading}>
        Crear mi cuenta DEMO
      </Button>
    </form>
  );
}
