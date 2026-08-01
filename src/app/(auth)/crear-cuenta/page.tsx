import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from './RegisterForm';
import { getAuth } from '@/lib/auth';
import { VirtualBalance } from '@tl/ui/compliance';

export const metadata: Metadata = {
  title: 'Crear mi cuenta DEMO',
  description:
    'Crea tu cuenta educativa y recibe USD 10.000 virtuales para practicar el análisis de mercados sin arriesgar dinero.',
};

export default async function RegisterPage() {
  const auth = await getAuth();
  if (auth) redirect(auth.user.onboardingCompleted ? '/panel' : '/onboarding');

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-soft)]">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Crea tu cuenta DEMO</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
        Sin tarjeta, sin depósitos y sin promesas de rentabilidad. Al terminar recibirás:
      </p>

      <div className="mt-4 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-gold)_24%,transparent)] bg-[var(--color-gold-soft)] p-4">
        <VirtualBalance cents={1_000_000} size="lg" />
      </div>

      <RegisterForm />

      <p className="mt-6 border-t border-[var(--color-border)] pt-5 text-center text-[13px] text-[var(--color-muted)]">
        ¿Ya tienes cuenta?{' '}
        <Link href="/entrar" className="font-medium text-[var(--color-blue)] hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
