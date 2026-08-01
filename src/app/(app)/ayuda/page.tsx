import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { Card, Callout, Badge } from '@tl/ui';
import { FAQ_ITEMS } from '@/components/marketing/sections';
import { SupportForm } from './SupportForm';

export const metadata: Metadata = { title: 'Centro de ayuda' };

const TOPICS = [
  {
    title: 'Sobre la cuenta DEMO',
    items: [
      {
        q: '¿Puedo depositar dinero?',
        a: 'No. TradingLab no admite depósitos de capital de trading y no existe ninguna función para hacerlo. Si alguien te ofrece depositar dinero diciendo representarnos, es un fraude: repórtalo desde este mismo formulario.',
      },
      {
        q: '¿Puedo retirar el saldo virtual?',
        a: 'No. El saldo DEMO es una unidad de cuenta pedagógica sin valor económico: no es convertible, no es transferible y no representa ningún derecho de crédito.',
      },
      {
        q: '¿Cuántas veces puedo reiniciar el saldo?',
        a: 'Una vez al mes en el plan Free, cuatro en Standard y diez en Premium. El reinicio se registra en el libro mayor de tu cuenta y no borra tu historial.',
      },
    ],
  },
  {
    title: 'Simulaciones',
    items: [
      {
        q: '¿Por qué mi stop loss se activó antes que el take profit si la vela tocó ambos?',
        a: 'Cuando ambos niveles se tocan dentro de la misma vela, el motor asume de forma conservadora que se ejecutó primero el stop loss. Una vela no conserva el orden temporal interno del movimiento, así que optamos por la hipótesis prudente y lo declaramos explícitamente.',
      },
      {
        q: '¿Puedo revisar cómo se calculó el resultado de una simulación?',
        a: 'Sí. Cada simulación guarda el precio de entrada y salida con su proveedor y marca temporal, los indicadores congelados en el momento de abrirla, la versión del motor y la traza completa del cálculo. Puedes verla en el historial de la terminal o exportarla desde tu perfil.',
      },
      {
        q: '¿Los precios son reales?',
        a: 'Junto a cada gráfico y cotización aparece la fuente, el estado del mercado y la latencia. Cuando la serie procede del motor educativo determinístico de TradingLab y no de un mercado real, se indica de forma explícita.',
      },
    ],
  },
  {
    title: 'Inteligencia artificial',
    items: [
      {
        q: '¿La IA puede decirme qué comprar?',
        a: 'No, y está diseñada para no poder hacerlo. Tiene prohibido dar órdenes imperativas de compra o venta, garantizar resultados e inventar precios o noticias. Un sistema de guardarraíles revisa cada respuesta antes de mostrártela y, si no la supera, se sustituye por el análisis determinístico de la plataforma.',
      },
      {
        q: '¿Qué datos míos se envían al modelo?',
        a: 'Solo el contexto de mercado (precios e indicadores ya calculados por nuestro servidor) y el texto que tú mismo has escrito. No enviamos tu nombre, tu correo ni ningún identificador que permita reidentificarte.',
      },
    ],
  },
  {
    title: 'Suscripciones',
    items: [
      {
        q: '¿Cómo cancelo?',
        a: 'Desde Perfil → Suscripción, en dos clics. No hay encuestas obligatorias ni necesidad de contactar con soporte. Conservas el acceso hasta el final del periodo ya abonado.',
      },
      {
        q: '¿Qué pasa con mi progreso si vuelvo al plan Free?',
        a: 'Nada se borra. Conservas tu historial, tu diario, tus certificados y tus insignias. Solo cambian los límites de uso y las funciones disponibles.',
      },
    ],
  },
];

export default async function HelpPage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Centro de ayuda</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-muted)]">
          Respuestas a lo que más se pregunta y un canal directo con nuestro equipo.
        </p>
      </header>

      <Callout tone="danger" title="Si alguien te pide dinero en nuestro nombre, es un fraude">
        TradingLab nunca solicita depósitos, transferencias ni datos de tarjeta fuera del portal de
        suscripción. Si recibes un contacto de este tipo, repórtalo desde el formulario de esta página
        seleccionando la categoría «Posible fraude».
      </Callout>

      {TOPICS.map((topic) => (
        <section key={topic.title}>
          <h2 className="text-[15px] font-semibold">{topic.title}</h2>
          <Card className="mt-3 divide-y divide-[var(--color-border)]">
            {topic.items.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[14px] font-medium">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-[var(--color-muted)] transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2.5 pr-6 text-[13px] leading-relaxed text-[var(--color-muted)]">{item.a}</p>
              </details>
            ))}
          </Card>
        </section>
      ))}

      <section>
        <h2 className="text-[15px] font-semibold">Preguntas generales</h2>
        <Card className="mt-3 divide-y divide-[var(--color-border)]">
          {FAQ_ITEMS.slice(0, 5).map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[14px] font-medium">
                {item.q}
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-[var(--color-muted)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-2.5 pr-6 text-[13px] leading-relaxed text-[var(--color-muted)]">{item.a}</p>
            </details>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold">Escríbenos</h2>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          Tiempo de respuesta habitual: 48 horas.{' '}
          {auth.user.plan === 'PREMIUM' && <Badge tone="violet">Soporte prioritario</Badge>}
        </p>
        <SupportForm />
      </section>

      <p className="text-[12px] text-[var(--color-muted)]">
        También puedes consultar el{' '}
        <Link href="/legal/naturaleza-del-servicio" className="text-[var(--color-blue)] hover:underline">
          documento sobre la naturaleza del servicio
        </Link>{' '}
        y el{' '}
        <Link href="/estado" className="text-[var(--color-blue)] hover:underline">
          estado del servicio
        </Link>
        .
      </p>
    </div>
  );
}
