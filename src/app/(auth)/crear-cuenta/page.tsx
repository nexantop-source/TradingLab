import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from './RegisterForm';
import { getAuth } from '@/lib/auth';
import { VirtualBalance } from '@tl/ui/compliance';
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
    <div className="auth-form-card rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-soft)]">
      <p className="auth-form-eyebrow">TU CRITERIO EMPIEZA AQUÍ</p>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Crea tu cuenta DEMO</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
        Sin tarjeta, sin depósitos y sin promesas de rentabilidad. Al terminar recibirás:
      </p>

      {intent && (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--color-blue)] bg-[var(--color-blue-soft)] px-3.5 py-3 text-[12px] leading-relaxed text-[var(--color-muted)]">
          Seleccionaste <strong className="text-[var(--color-text)]">{intent.plan === 'STANDARD' ? 'Plus' : 'Pro'} {intent.interval === 'YEARLY' ? 'anual' : 'mensual'}</strong>. Crear la cuenta es gratis; verás el importe exacto en COP antes de abrir Wompi.
        </p>
      )}

      <div className="mt-4 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-gold)_24%,transparent)] bg-[var(--color-gold-soft)] p-4">
        <VirtualBalance cents={1_000_000} size="lg" />
      </div>

      <RegisterForm intent={intent} />

      <p className="mt-6 border-t border-[var(--color-border)] pt-5 text-center text-[13px] text-[var(--color-muted)]">
        ¿Ya tienes cuenta?{' '}
        <Link href={`/entrar${checkoutQuery(intent)}`} className="font-medium text-[var(--color-blue)] hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
