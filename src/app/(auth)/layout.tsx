import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { ArrowLeft, BookOpen, ScanLine, NotebookPen } from 'lucide-react';

/**
 * Iniciar sesión y crear cuenta redirigen si ya hay sesión, así que su
 * respuesta depende de la cookie y no admite caché compartida.
 */
export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell auth-refresh">
      <header className="auth-header">
        <Link href="/" aria-label="TradingLab, ir al inicio">
          <Logo size="sm" />
        </Link>
        <Link href="/" className="auth-back-home"><ArrowLeft size={15} aria-hidden="true" /> Volver al inicio</Link>
      </header>

      <main id="contenido" className="auth-app-layout">
        <aside className="auth-art-panel" aria-label="Aprender con TradingLab">
          <span className="auth-story-eyebrow">TU PRIMERA INVERSIÓN: APRENDER</span>
          <h2>Antes de invertir,<br /><em>aprende a decidir.</em></h2>
          <p className="auth-story-intro">Dale una base a tus decisiones. Entiende los mercados y practica con dinero virtual, paso a paso.</p>
          <div className="auth-practice-card">
            <span className="auth-practice-label"><ScanLine size={16} aria-hidden="true" /> UNA PREGUNTA PARA EMPEZAR</span>
            <p>¿Qué deberías entender<br />antes de invertir tu dinero?</p>
            <div className="auth-concept-list"><span>Tu objetivo</span><span>El plazo</span><span>El riesgo</span></div>
            <small>Empieza por el porqué. Después, practica el cómo.</small>
          </div>
          <ol className="auth-learning-path">
            <li><BookOpen size={19} aria-hidden="true" /><div><strong>Entiende</strong><span>Conceptos explicados con claridad.</span></div></li>
            <li><ScanLine size={19} aria-hidden="true" /><div><strong>Practica</strong><span>Ejercicios con saldo virtual.</span></div></li>
            <li><NotebookPen size={19} aria-hidden="true" /><div><strong>Reflexiona</strong><span>Un diario para revisar tus decisiones.</span></div></li>
          </ol>
          <span className="auth-story-footer">Educación financiera · Hecho en Colombia</span>
        </aside>
        <section className="auth-form-panel" aria-label="Acceso a TradingLab">
          {children}
        </section>
      </main>

      <footer className="auth-footer">
        <div>
          <p>TradingLab es una plataforma educativa. Las operaciones y el saldo son virtuales. No recibe capital de inversión ni permite retiros. Aprender no garantiza rentabilidad.</p>
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
