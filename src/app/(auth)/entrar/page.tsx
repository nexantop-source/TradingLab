import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from './LoginForm';
import { getAuth } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Accede a tu cuenta educativa de TradingLab.',
};

export default async function LoginPage() {
  const auth = await getAuth();
  if (auth) redirect(auth.user.onboardingCompleted ? '/panel' : '/onboarding');

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-soft)]">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Inicia sesión</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
        Continúa con tu ruta educativa y tu cuenta DEMO.
      </p>

      <LoginForm />

      <p className="mt-6 border-t border-[var(--color-border)] pt-5 text-center text-[13px] text-[var(--color-muted)]">
        ¿Todavía no tienes cuenta?{' '}
        <Link href="/crear-cuenta" className="font-medium text-[var(--color-blue)] hover:underline">
          Crea tu cuenta DEMO gratis
        </Link>
      </p>
    </div>
  );
}
