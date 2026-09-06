import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, ShieldAlert } from 'lucide-react';
import { verifyCertificate } from '@/lib/certificates';
import { LEGAL_ENTITY_DESCRIPTOR } from '@tl/types/compliance';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verificar certificado',
  description: 'Comprueba la autenticidad de un certificado emitido por TradingLab.',
  // Un código de verificación no debe acabar en un buscador.
  robots: { index: false, follow: false },
};

/**
 * Comprobación pública de un certificado.
 *
 * Es deliberadamente pública y sin sesión: un certificado que solo puede
 * verificar quien lo posee no acredita nada ante un tercero. Se muestra lo
 * justo -a nombre de quién, qué ruta y cuándo-, nunca el correo, el
 * identificador de la cuenta ni su plan.
 */
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const certificate = await verifyCertificate(decodeURIComponent(code));

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      {certificate ? (
        <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <BadgeCheck size={28} className="text-[var(--color-positive)]" aria-hidden="true" />
          <p className="mt-5 text-[length:var(--text-2xs)] uppercase tracking-[0.14em] text-[var(--color-subtle)]">
            Certificado auténtico
          </p>
          <h1 className="mt-3 text-[length:var(--text-xl)] font-semibold tracking-[-0.02em]">
            {certificate.holderName}
          </h1>
          <p className="mt-2 text-[length:var(--text-sm)] leading-relaxed text-[var(--color-muted)]">
            completó la ruta formativa <strong className="text-[var(--color-text)]">{certificate.trackTitle}</strong> el{' '}
            <time dateTime={certificate.issuedAt.toISOString()} className="num">
              {certificate.issuedAt.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
            </time>
            .
          </p>

          <hr className="my-6 border-0 border-t border-[var(--color-border)]" />

          <p className="text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-subtle)]">
            Este certificado acredita la finalización de un programa educativo: todas las lecciones de la ruta,
            con sus cuestionarios superados. {LEGAL_ENTITY_DESCRIPTOR}. No es una licencia profesional, no habilita
            para gestionar dinero de terceros y no acredita resultados de inversión: toda la práctica se realiza con
            dinero virtual.
          </p>
        </article>
      ) : (
        <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <ShieldAlert size={28} className="text-[var(--color-gold)]" aria-hidden="true" />
          <h1 className="mt-5 text-[length:var(--text-xl)] font-semibold tracking-[-0.02em]">
            No encontramos este certificado
          </h1>
          <p className="mt-3 text-[length:var(--text-sm)] leading-relaxed text-[var(--color-muted)]">
            El código no corresponde a ningún certificado con verificación pública. Comprueba que lo has copiado
            completo, incluidos los guiones.
          </p>
          <p className="mt-3 text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-subtle)]">
            Los comprobantes de finalización del plan Plus no son verificables públicamente; solo lo son los
            certificados del plan Pro.
          </p>
        </article>
      )}

      <p className="mt-6 text-[length:var(--text-xs)]">
        <Link href="/" className="text-[var(--color-blue)]">
          Conocer TradingLab →
        </Link>
      </p>
    </div>
  );
}
