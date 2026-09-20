'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Callout, Checkbox, Field, Input, Select } from '@tl/ui';
import { PasswordInput } from '@/components/pwa/PasswordInput';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import { onboardingPath, type CheckoutIntent } from '@/lib/checkout-intent';
import { registerSchema } from '@/lib/validation';
import { ArrowLeft } from 'lucide-react';

const detailsSchema = registerSchema.pick({ name: true, email: true, password: true, countryCode: true });
const DETAIL_FIELDS = ['name', 'email', 'password', 'countryCode'];

/** Países con mayor presencia hispanohablante, más una entrada libre. */
const COUNTRIES = [
  { code: 'CO', name: 'Colombia' },
  { code: 'ES', name: 'España' },
  { code: 'MX', name: 'México' },
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
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [timezone, setTimezone] = React.useState('UTC');
  const [step, setStep] = React.useState(0);
  const submitting = React.useRef(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const stepHeading = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    const name = Object.keys(fieldErrors)[0];
    if (name) (formRef.current?.elements.namedItem(name) as HTMLElement | null)?.focus();
    else if (step === 1) stepHeading.current?.focus();
  }, [fieldErrors, step]);

  React.useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    } catch {
      setTimezone('UTC');
    }
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    setError(null);
    setFieldErrors({});

    const data = new FormData(e.currentTarget);
    const input = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      countryCode: String(data.get('countryCode') ?? 'CO'),
      timezone, locale: 'es',
      acceptTerms: data.get('acceptTerms') === 'on',
      acceptRisk: data.get('acceptRisk') === 'on',
      confirmAge: data.get('confirmAge') === 'on',
      marketingOptIn: data.get('marketingOptIn') === 'on',
    };
    const parsed = (step === 0 ? detailsSchema : registerSchema).safeParse(input);
    if (!parsed.success) {
      const errors = Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([name, messages]) => [name, messages?.[0] ?? 'Revisa este campo.']));
      if (DETAIL_FIELDS.some(name => errors[name])) setStep(0);
      setFieldErrors(errors);
      return;
    }
    if (step === 0) { setStep(1); return; }
    submitting.current = true;
    setLoading(true);

    try {
      await apiFetch<{ next: string }>('/api/auth/register', {
        method: 'POST',
        json: input,
      });
      // Cross the new-session boundary with an uncached document request.
      window.location.replace(onboardingPath(intent));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors());
        if (DETAIL_FIELDS.some(name => err.fieldErrors()[name]) || err.code === 'EMAIL_IN_USE') setStep(0);
      } else {
        setError('No hemos podido conectar con el servidor. Comprueba tu conexión.');
      }
      setLoading(false);
      submitting.current = false;
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="auth-form" noValidate aria-busy={loading}>
      <ol className="auth-steps" aria-label="Pasos para crear tu cuenta">
        <li aria-current={step === 0 ? 'step' : undefined}><span>1</span> Tus datos</li>
        <li aria-current={step === 1 ? 'step' : undefined}><span>2</span> Tu cuenta educativa</li>
      </ol>
      {error && (
        <Callout tone="danger" title="No se ha podido crear la cuenta">
          {error}
        </Callout>
      )}

      <fieldset className="auth-step-fields" hidden={step !== 0}>
      <legend className="sr-only">Tus datos</legend>
      <Field label="Nombre" htmlFor="name" error={fieldErrors.name} required>
        <Input id="name" name="name" autoComplete="name" required placeholder="Cómo quieres que te llamemos" />
      </Field>

      <Field label="Correo electrónico" htmlFor="email" error={fieldErrors.email} required>
        <Input id="email" name="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="email" required placeholder="tu@correo.com" />
      </Field>

      <Field
        label="Contraseña"
        htmlFor="password"
        hint="Usa al menos 10 caracteres. Evita contraseñas comunes o solo números."
        error={fieldErrors.password}
        required
      >
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} />
      </Field>

      <Field
        label="País de residencia"
        htmlFor="countryCode"
        error={fieldErrors.countryCode}
        required
      >
        <Select id="countryCode" name="countryCode" defaultValue="CO" required>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      </fieldset>

      <fieldset className="auth-step-fields" hidden={step !== 1}>
      <legend className="sr-only">Tu cuenta educativa</legend>
      <h2 ref={stepHeading} tabIndex={-1} className="auth-step-heading">Un último paso para empezar</h2>
      <div className="auth-consents">
        <Checkbox
          name="confirmAge"
          id="confirmAge"
          aria-invalid={Boolean(fieldErrors.confirmAge) || undefined}
          aria-describedby={fieldErrors.confirmAge ? 'confirmAge-error' : undefined}
          required
          label="Confirmo que tengo la mayoría de edad según la legislación de mi país de residencia."
        />
        <Checkbox
          name="acceptTerms"
          id="acceptTerms"
          aria-invalid={Boolean(fieldErrors.acceptTerms) || undefined}
          aria-describedby={fieldErrors.acceptTerms ? 'acceptTerms-error' : undefined}
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
          id="acceptRisk"
          aria-invalid={Boolean(fieldErrors.acceptRisk) || undefined}
          aria-describedby={fieldErrors.acceptRisk ? 'acceptRisk-error' : undefined}
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
        <p id="acceptTerms-error" role="alert" className="text-xs text-[var(--color-negative)]">
          {fieldErrors.acceptTerms}
        </p>
      )}
      {fieldErrors.acceptRisk && (
        <p id="acceptRisk-error" role="alert" className="text-xs text-[var(--color-negative)]">
          {fieldErrors.acceptRisk}
        </p>
      )}
      {fieldErrors.confirmAge && (
        <p id="confirmAge-error" role="alert" className="text-xs text-[var(--color-negative)]">
          {fieldErrors.confirmAge}
        </p>
      )}
      <button type="button" className="auth-edit-details" disabled={loading} onClick={() => { setStep(0); setFieldErrors({}); requestAnimationFrame(() => (formRef.current?.elements.namedItem('name') as HTMLInputElement | null)?.focus()); }}><ArrowLeft size={15} aria-hidden="true" /> Revisar mis datos</button>
      </fieldset>

      <Button type="submit" fullWidth size="lg" loading={loading}>
        {step === 0 ? 'Continuar' : 'Crear mi cuenta gratis'}
      </Button>
    </form>
  );
}
