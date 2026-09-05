import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { RiskWarning, ServiceNature, SimulationPill } from '@tl/ui/compliance';
import { LEGAL_ENTITY_DESCRIPTOR } from '@tl/types/compliance';
import { PAYMENT_REGION_NOTICE } from '@/lib/payment-copy';

const COLUMNS = [
  {
    title: 'Producto',
    links: [
      { href: '/terminal', label: 'Trading DEMO' },
      { href: '/recursos', label: 'Academia' },
      { href: '/mercados', label: 'Mercados disponibles' },
      { href: '/precios', label: 'Planes y precios' },
      { href: '/entrenador', label: 'Entrenador con IA' },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { href: '/recursos', label: 'Centro de recursos' },
      { href: '/recursos#articulos', label: 'Artículos educativos' },
      { href: '/glosario', label: 'Glosario' },
      { href: '/ayuda', label: 'Centro de ayuda' },
      { href: '/estado', label: 'Estado del servicio' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/naturaleza-del-servicio', label: 'Naturaleza del servicio' },
      { href: '/legal/terminos', label: 'Términos y condiciones' },
      { href: '/legal/privacidad', label: 'Política de privacidad' },
      { href: '/legal/cookies', label: 'Política de cookies' },
      { href: '/legal/publicidad', label: 'Política publicitaria' },
      { href: '/legal/riesgo', label: 'Advertencia de riesgo' },
      { href: '/legal/ia', label: 'Uso de inteligencia artificial' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { href: '/contacto', label: 'Contacto' },
      { href: '/anunciantes', label: 'Anunciantes y patrocinios' },
      { href: '/ayuda', label: 'Soporte' },
    ],
  },
];

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-6xl px-5 py-14">
        {/* Aviso de simulación, en primer lugar y no en letra pequeña. */}
        <div className="mb-12 rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--color-gold)_24%,transparent)] bg-[var(--color-gold-soft)] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <SimulationPill />
            <p className="text-[13px] font-medium text-[var(--color-text)]">
              TradingLab es una {LEGAL_ENTITY_DESCRIPTOR.toLowerCase()}.
            </p>
          </div>
          <ServiceNature className="mt-3 !text-[12px] !text-[var(--color-muted)]" />
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo size="md" />
            <p className="mt-4 max-w-56 text-[13px] leading-relaxed text-[var(--color-muted)]">
              Aprende a analizar los mercados sin arriesgar tu dinero.
            </p>
            <div className="mt-5 flex gap-2">
              <SocialLink href="https://www.youtube.com" label="YouTube" />
              <SocialLink href="https://www.linkedin.com" label="LinkedIn" />
              <SocialLink href="https://www.instagram.com" label="Instagram" />
              <SocialLink href="https://x.com" label="X" />
            </div>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 space-y-4 border-t border-[var(--color-border)] pt-8">
          <p className="max-w-3xl text-[12px] leading-relaxed text-[var(--color-muted)]">{PAYMENT_REGION_NOTICE}</p>
          <RiskWarning />
          <p className="text-[11px] leading-relaxed text-[var(--color-subtle)]">
            Los precios que se muestran en la plataforma se utilizan exclusivamente con fines educativos. Los
            resultados históricos o simulados no representan rendimientos futuros. La inteligencia artificial de
            TradingLab es una herramienta educativa y no un asesor financiero personal. TradingLab no está
            afiliada a ninguna de las plataformas o marcas mencionadas con fines comparativos.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-[11px] text-[var(--color-subtle)]">
              © {year} TradingLab. Todos los derechos reservados.
            </p>
            <p className="text-[11px] text-[var(--color-subtle)]">Contenido en español · Próximamente en inglés y portugués</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--color-border)] text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
    >
      {label.slice(0, 2)}
    </a>
  );
}
