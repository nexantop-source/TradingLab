import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from './RegisterForm';
import { getAuth } from '@/lib/auth';
import { checkoutPath, checkoutQuery, onboardingPath, parseCheckoutIntent } from '@/lib/checkout-intent';

export const metadata: Metadata = {
  title: 'Crear mi cuenta DEMO',
  description:
    'Crea tu cuenta educativa y recibe USD 10.000 virtuales para practicar el análisis de mercados sin arriesgar dinero.',
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  const intent = parseCheckoutIntent(await searchParams);
  const auth = await getAuth();
  if (auth) {
    if (auth.user.onboardingCompleted) redirect(intent ? checkoutPath(intent) : '/panel');
    redirect(onboardingPath(intent));
  }

  return (
    <div className="auth-form-card">
      <p className="auth-form-eyebrow">EMPIEZA CON LO QUE SABES HOY</p>
      <h1>Aprender a invertir<br />empieza contigo.</h1>
      <p className="auth-form-intro">
        Crea tu cuenta gratis y da tu primer paso. No necesitas experiencia ni tarjeta.
      </p>

      {intent && (
        <p className="auth-intent-note">
          Seleccionaste <strong className="text-[var(--color-text)]">{intent.plan === 'STANDARD' ? 'Plus' : 'Pro'} {intent.interval === 'YEARLY' ? 'anual' : 'mensual'}</strong>. Crear la cuenta es gratis; verás el importe exacto en COP antes de abrir Wompi.
        </p>
      )}

      <p className="auth-free-note">Explore incluido · USD 10.000 virtuales para practicar</p>

      <RegisterForm intent={intent} />

      <p className="auth-switch">
        ¿Ya tienes cuenta?{' '}
        <Link href={`/entrar${checkoutQuery(intent)}`} className="font-medium text-[var(--color-blue)] hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
