import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL_DOCS } from '@/content/legal';
import { WHAT_WE_DO, WHAT_WE_DO_NOT_DO } from '@tl/types/compliance';
import { Badge, Card } from '@tl/ui';
import { Check, X } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Centro legal y de cumplimiento',
  description:
    'Naturaleza del servicio, términos, privacidad, cookies, política publicitaria, advertencia de riesgo y uso de inteligencia artificial.',
};

export default function LegalIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <header>
        <Badge tone="blue">Cumplimiento</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Centro legal y de cumplimiento</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Todo lo que necesitas saber sobre qué es TradingLab, qué no es y cómo tratamos tus datos. Cada
          documento está versionado y registramos qué versión aceptaste y cuándo.
        </p>
      </header>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <Card className="border-[color-mix(in_srgb,var(--color-negative)_22%,transparent)] bg-[var(--color-negative-soft)] p-5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--color-negative)]">
            <X className="size-4" aria-hidden="true" />
            Lo que TradingLab no hace
          </h2>
          <ul className="mt-3 space-y-2">
            {WHAT_WE_DO_NOT_DO.map((t) => (
              <li key={t} className="text-[13px] leading-relaxed text-[var(--color-muted)]">
                · {t}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="border-[color-mix(in_srgb,var(--color-positive)_22%,transparent)] bg-[var(--color-positive-soft)] p-5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--color-positive)]">
            <Check className="size-4" aria-hidden="true" />
            Lo que sí hace
          </h2>
          <ul className="mt-3 space-y-2">
            {WHAT_WE_DO.map((t) => (
              <li key={t} className="text-[13px] leading-relaxed text-[var(--color-muted)]">
                · {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <h2 className="mt-12 text-xl font-semibold tracking-tight">Documentos</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {LEGAL_DOCS.map((d) => (
          <Link key={d.slug} href={`/legal/${d.slug}`}>
            <Card className="h-full p-5 transition-colors hover:border-[var(--color-blue)]">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[14px] font-semibold">{d.title}</h3>
                <Badge tone="neutral">v{d.version}</Badge>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-muted)]">{d.summary}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
