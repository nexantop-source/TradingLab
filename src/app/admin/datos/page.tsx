import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { listProviders, marketData, SYMBOLS, ASSET_CLASS_LABEL_SAFE } from './helpers';
import { Badge, Card, Callout } from '@tl/ui';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Proveedores de datos' };
export const dynamic = 'force-dynamic';

export default async function AdminDataPage() {
  const auth = await getAuth();
  if (!auth || !can(auth.user.role, 'data:read')) redirect('/panel');

  const active = marketData();
  const providers = listProviders();
  const records = await db.dataProviderRecord.findMany({ orderBy: { active: 'desc' } });
  const health = await active.healthCheck().catch(() => ({ ok: false, latencyMs: 0, message: 'sin respuesta' }));

  const byClass = new Map<string, number>();
  for (const s of SYMBOLS) byClass.set(s.assetClass, (byClass.get(s.assetClass) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Proveedores de datos</h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[var(--color-muted)]">
          La aplicación nunca habla directamente con un proveedor: siempre lo hace a través de una interfaz común.
          Cambiar de proveedor consiste en registrar otra implementación y modificar una variable de entorno.
        </p>
      </header>

      <Callout tone={health.ok ? 'success' : 'warning'} title={`Proveedor activo: ${active.label}`}>
        {health.message} Latencia de comprobación: {health.latencyMs} ms.
        {active.synthetic &&
          ' Al tratarse de una serie educativa determinística, la interfaz lo indica junto a cada gráfico y cotización.'}
      </Callout>

      <Card className="overflow-x-auto">
        <div className="border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">Proveedores registrados</h2>
        </div>
        <table className="w-full min-w-[44rem] text-[12px]">
          <caption className="sr-only">Proveedores de datos de mercado registrados</caption>
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Identificador</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Nombre</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Tipo</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Latencia declarada</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Atribución obligatoria</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Estado</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Última comprobación</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const runtime = providers.find((p) => p.id === r.id);
              return (
                <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="num px-4 py-2.5 font-medium">{r.id}</td>
                  <td className="px-4 py-2.5 text-[var(--color-muted)]">{r.label}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={r.synthetic ? 'violet' : 'blue'}>
                      {r.synthetic ? 'Serie educativa' : 'Mercado real'}
                    </Badge>
                  </td>
                  <td className="num px-4 py-2.5 text-right text-[var(--color-muted)]">{r.declaredDelaySec} s</td>
                  <td className="px-4 py-2.5 text-[var(--color-muted)]">
                    {runtime?.attribution ? (
                      <a
                        href={runtime.attribution.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-blue)] hover:underline"
                      >
                        {runtime.attribution.text}
                      </a>
                    ) : (
                      'No requerida'
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={r.id === active.id ? 'positive' : r.active ? 'blue' : 'neutral'}>
                      {r.id === active.id ? 'Activo' : r.lastStatus ?? 'inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-[var(--color-muted)]">
                    {r.lastHealthCheck ? formatDateTime(r.lastHealthCheck, auth.user.timezone) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Catálogo de instrumentos</h2>
        <ul className="mt-3 space-y-1.5">
          {Array.from(byClass.entries()).map(([cls, count]) => (
            <li key={cls} className="flex justify-between text-[13px]">
              <span className="text-[var(--color-muted)]">{ASSET_CLASS_LABEL_SAFE(cls)}</span>
              <span className="num">{count} instrumentos</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Política de atribución de terceros</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
          Cuando un proveedor o una biblioteca de gráficos exige atribución por licencia, esta se renderiza en el
          componente <span className="num">ChartAttribution</span>, junto al gráfico y siempre visible. Está
          prohibido ocultarla mediante CSS, opacidad, capas superpuestas o manipulación del DOM. El gráfico
          actual es una implementación propia sobre canvas, sin dependencias de terceros y sin atribución
          obligatoria asociada.
        </p>
      </Card>
    </div>
  );
}
