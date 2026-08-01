import type { Metadata } from 'next';
import { marketData, listProviders } from '@tl/market-data';
import { isAIConfigured } from '@tl/ai';
import { Badge, Card } from '@tl/ui';

export const metadata: Metadata = {
  title: 'Estado del servicio',
  description: 'Disponibilidad de los componentes de TradingLab y de sus proveedores de datos.',
};

export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const provider = marketData();
  const health = await provider.healthCheck().catch(() => ({
    ok: false,
    latencyMs: 0,
    message: 'No se ha podido comprobar el proveedor.',
  }));

  const components = [
    {
      name: 'Aplicación web',
      status: 'ok' as const,
      detail: 'Interfaz y navegación operativas.',
    },
    {
      name: 'Motor de simulación',
      status: 'ok' as const,
      detail: 'Determinístico y auditable. Versión del motor registrada en cada operación.',
    },
    {
      name: `Datos de mercado · ${provider.label}`,
      status: health.ok ? ('ok' as const) : ('degraded' as const),
      detail: `${health.message} Latencia de comprobación: ${health.latencyMs} ms.`,
    },
    {
      name: 'Entrenador educativo',
      status: isAIConfigured() ? ('ok' as const) : ('degraded' as const),
      detail: isAIConfigured()
        ? 'Proveedor de inteligencia artificial configurado. Los guardarraíles se aplican a cada respuesta.'
        : 'Sin credencial de proveedor: los análisis los genera el motor educativo determinístico local, con las mismas reglas de conducta.',
    },
    {
      name: 'Suscripciones',
      status: process.env.BILLING_PROVIDER === 'mock' ? ('degraded' as const) : ('ok' as const),
      detail:
        process.env.BILLING_PROVIDER === 'mock'
          ? 'Pasarela en modo de demostración: no se procesan cargos reales.'
          : 'Pasarela de pagos operativa.',
    },
  ];

  const STATUS_META = {
    ok: { label: 'Operativo', tone: 'positive' as const },
    degraded: { label: 'Funcionamiento limitado', tone: 'gold' as const },
    down: { label: 'Interrumpido', tone: 'negative' as const },
  };

  const overall = components.some((c) => c.status === 'degraded') ? 'degraded' : 'ok';

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <header>
        <Badge tone={STATUS_META[overall].tone}>{STATUS_META[overall].label}</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Estado del servicio</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-muted)]">
          Comprobación en tiempo real de los componentes de la plataforma. Actualizado en cada carga de esta
          página.
        </p>
      </header>

      <ul className="mt-8 space-y-2">
        {components.map((c) => (
          <li key={c.name}>
            <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{c.name}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">{c.detail}</p>
              </div>
              <Badge tone={STATUS_META[c.status].tone}>{STATUS_META[c.status].label}</Badge>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="mt-8 p-5">
        <h2 className="text-[13px] font-semibold">Proveedores de datos registrados</h2>
        <ul className="mt-3 space-y-2">
          {listProviders().map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="num font-medium">{p.id}</span>
              <span className="text-[var(--color-muted)]">{p.label}</span>
              {p.synthetic && <Badge tone="violet">Serie educativa</Badge>}
              {p.id === provider.id && <Badge tone="blue">Activo</Badge>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-subtle)]">
          La arquitectura permite cambiar de proveedor sin modificar el resto de la aplicación: basta con
          registrar una implementación de la interfaz común y cambiar una variable de entorno.
        </p>
      </Card>
    </div>
  );
}
