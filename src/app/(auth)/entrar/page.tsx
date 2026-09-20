import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from './LoginForm';
import { getAuth } from '@/lib/auth';
import { checkoutPath, checkoutQuery, onboardingPath, parseCheckoutIntent } from '@/lib/checkout-intent';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Accede a tu cuenta educativa de TradingLab.',
};

export default async function LoginPage({
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
      <p className="auth-form-eyebrow">BIENVENIDO DE NUEVO</p>
      <h1>Tu próximo paso<br />empieza aquí.</h1>
      <p className="auth-form-intro">
        Inicia sesión para retomar tus lecciones, prácticas y diario.
      </p>

      {intent && <p className="auth-intent-note">Al entrar podrás revisar tu plan {intent.plan === 'STANDARD' ? 'Plus' : 'Pro'} {intent.interval === 'YEARLY' ? 'anual' : 'mensual'} antes de pagar con Wompi.</p>}

      <LoginForm intent={intent} />

      <p className="auth-switch">
        ¿Todavía no tienes cuenta?{' '}
        <Link href={`/crear-cuenta${checkoutQuery(intent)}`} className="font-medium text-[var(--color-blue)] hover:underline">
          Empieza gratis
        </Link>
      </p>
    </div>
  );
}
