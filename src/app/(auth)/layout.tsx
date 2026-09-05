import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { MarketArtwork } from '@/components/pwa/MarketArtwork';
import { ServiceNature, SimulationPill } from '@tl/ui/compliance';

/**
 * Iniciar sesión y crear cuenta redirigen si ya hay sesión, así que su
 * respuesta depende de la cookie y no admite caché compartida.
 */
export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell relative min-h-dvh">
      <div aria-hidden="true" className="mesh-aurora absolute inset-0 -z-10 opacity-60" />

      <header className="px-5 py-6">
        <Link href="/" aria-label="TradingLab, ir al inicio">
          <Logo size="sm" />
        </Link>
      </header>

      <main id="contenido" className="auth-app-layout">
        <aside className="auth-art-panel">
          <span className="ios-eyebrow">APRENDE PRIMERO. DECIDE MEJOR.</span>
          <h2>Un espacio para<br />tu próximo paso.</h2>
          <MarketArtwork compact />
          <p>Mercados, lecciones y práctica.<br />Todo empieza con tu curiosidad.</p>
          <Link href="/app" className="glass-link">Conoce la app →</Link>
        </aside>
        <section className="auth-form-panel" aria-label="Acceso a TradingLab">
          <div className="mb-6 flex justify-center">
            <SimulationPill />
          </div>
          {children}
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)] px-5 py-8">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <ServiceNature />
          <nav aria-label="Enlaces legales" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {[
              { href: '/legal/naturaleza-del-servicio', label: 'Naturaleza del servicio' },
              { href: '/legal/terminos', label: 'Términos' },
              { href: '/legal/privacidad', label: 'Privacidad' },
              { href: '/legal/riesgo', label: 'Advertencia de riesgo' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[11px] text-[var(--color-muted)] underline-offset-2 hover:underline"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
