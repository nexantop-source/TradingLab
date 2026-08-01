import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Badge, Callout } from '@tl/ui';

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Canales de contacto de TradingLab para estudiantes, anunciantes, prensa y cumplimiento.',
};

const CHANNELS = [
  {
    title: 'Soporte a estudiantes',
    email: 'soporte@tradinglab.example',
    body: 'Dudas sobre tu cuenta, la academia, las simulaciones o la suscripción. Si tienes cuenta, el centro de ayuda es el canal más rápido.',
    href: '/ayuda',
    cta: 'Ir al centro de ayuda',
  },
  {
    title: 'Anunciantes y patrocinios',
    email: 'comercial@tradinglab.example',
    body: 'Inventario disponible, paquetes de patrocinio y condiciones para campañas. Incluye en tu mensaje el producto, la audiencia objetivo y el formato que te interesa.',
    href: '/anunciantes',
    cta: 'Ver el inventario',
  },
  {
    title: 'Cumplimiento y privacidad',
    email: 'privacidad@tradinglab.example',
    body: 'Ejercicio de derechos sobre tus datos, solicitudes de eliminación y consultas de cumplimiento normativo.',
    href: '/legal/privacidad',
    cta: 'Política de privacidad',
  },
  {
    title: 'Prensa e instituciones',
    email: 'prensa@tradinglab.example',
    body: 'Solicitudes de información, colaboraciones con centros educativos y programa de becas.',
    href: '/legal/naturaleza-del-servicio',
    cta: 'Naturaleza del servicio',
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <header>
        <Badge tone="blue">Contacto</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Hablemos</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
          Elige el canal adecuado y responderemos lo antes posible.
        </p>
      </header>

      <Callout tone="danger" className="mt-8" title="Nunca pedimos dinero por ningún canal">
        TradingLab no solicita depósitos, transferencias ni datos de tarjeta fuera del portal de suscripción.
        Si recibes un contacto de ese tipo diciendo representarnos, es un fraude. Repórtalo escribiendo a
        soporte@tradinglab.example o desde el centro de ayuda.
      </Callout>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {CHANNELS.map((c) => (
          <Card key={c.title} className="p-5">
            <h2 className="text-[14px] font-semibold">{c.title}</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">{c.body}</p>
            <a
              href={`mailto:${c.email}`}
              className="num mt-3 block text-[12px] text-[var(--color-blue)] hover:underline"
            >
              {c.email}
            </a>
            <Link href={c.href} className="mt-1 block text-[12px] text-[var(--color-muted)] hover:underline">
              {c.cta} →
            </Link>
          </Card>
        ))}
      </div>

      <Card className="mt-8 p-5">
        <h2 className="text-[13px] font-semibold">Información corporativa</h2>
        <dl className="mt-3 space-y-2 text-[12px]">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--color-subtle)]">Denominación del servicio</dt>
            <dd className="text-right text-[var(--color-muted)]">
              Plataforma educativa de análisis y simulación de mercados financieros
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--color-subtle)]">Naturaleza</dt>
            <dd className="text-right text-[var(--color-muted)]">
              No es un broker regulado ni una entidad de servicios de inversión
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--color-subtle)]">Idioma de atención</dt>
            <dd className="text-right text-[var(--color-muted)]">Español</dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-[11px] leading-relaxed text-[var(--color-subtle)]">
          Los datos registrales completos (razón social, domicilio e identificación fiscal) deben completarse
          antes de la explotación comercial, junto con la revisión jurídica de los documentos del centro legal.
        </p>
      </Card>
    </div>
  );
}
