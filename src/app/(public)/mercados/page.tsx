import type { Metadata } from 'next';
import Link from 'next/link';
import { SYMBOLS } from '@tl/market-data';
import { ASSET_CLASSES, ASSET_CLASS_LABEL } from '@tl/types';
import { Badge, Button, Card } from '@tl/ui';

export const metadata: Metadata = {
  title: 'Mercados disponibles',
  description:
    'Forex, criptomonedas, acciones, índices y commodities disponibles para practicar en el simulador educativo de TradingLab.',
};

const RISK_LABEL = ['', 'Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto'];

export default function MarketsPage() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-5 pb-4 pt-8 text-center">
        <Badge tone="blue">Mercados</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em]">
          {SYMBOLS.length} instrumentos para practicar
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Cada instrumento tiene su propio horario, su volatilidad característica y su spread virtual calibrado
          según la liquidez real del activo. Operar EUR/USD y operar un criptoactivo pequeño no cuesta lo mismo,
          y el simulador lo refleja.
        </p>
      </section>

      <div className="mx-auto max-w-5xl space-y-12 px-5 py-14">
        {ASSET_CLASSES.map((assetClass) => {
          const items = SYMBOLS.filter((s) => s.assetClass === assetClass);

          if (items.length === 0) {
            return (
              <section key={assetClass}>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold tracking-tight">{ASSET_CLASS_LABEL[assetClass]}</h2>
                  <Badge tone="neutral">Próximamente</Badge>
                </div>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-muted)]">
                  Los ETF se incorporarán cuando dispongamos de una fuente de datos autorizada que los cubra con
                  la licencia adecuada. Preferimos esperar antes de mostrar precios sin procedencia verificable.
                </p>
              </section>
            );
          }

          return (
            <section key={assetClass}>
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-xl font-semibold tracking-tight">{ASSET_CLASS_LABEL[assetClass]}</h2>
                <span className="num text-[12px] text-[var(--color-subtle)]">{items.length} instrumentos</span>
              </div>
              <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">{items[0].session.label}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((s) => (
                  <Card key={s.symbol} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="num text-[14px] font-semibold">{s.symbol}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--color-subtle)]">{s.name}</p>
                      </div>
                      {s.minPlan !== 'FREE' && <Badge tone="gold">{s.minPlan}</Badge>}
                    </div>
                    <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-muted)]">{s.description}</p>
                    <dl className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3 text-[11px]">
                      <div className="flex justify-between gap-2">
                        <dt className="text-[var(--color-subtle)]">Riesgo educativo</dt>
                        <dd className="text-[var(--color-muted)]">{RISK_LABEL[s.educationalRisk]}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[var(--color-subtle)]">Spread virtual</dt>
                        <dd className="num text-[var(--color-muted)]">{s.spreadBps} pb</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[var(--color-subtle)]">Divisa</dt>
                        <dd className="num text-[var(--color-muted)]">{s.quoteCurrency}</dd>
                      </div>
                    </dl>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Sobre la procedencia de los precios</h2>
          <p className="mx-auto mt-4 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
            Junto a cada gráfico y a cada cotización aparece siempre la fuente del dato, el estado del mercado y
            la latencia estimada. Cuando la serie procede de nuestro motor educativo determinístico y no de un
            mercado real, la interfaz lo indica de forma explícita. La arquitectura permite cambiar de proveedor
            de datos sin modificar el resto de la aplicación.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/crear-cuenta">
              <Button size="lg">Crear mi cuenta DEMO</Button>
            </Link>
            <Link href="/legal/naturaleza-del-servicio">
              <Button size="lg" variant="outline">
                Naturaleza del servicio
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
