import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import { verifyLedger } from '@tl/simulation-engine';
import { Badge, Card, Callout } from '@tl/ui';
import { formatDateTime, formatVirtualUsd } from '@/lib/format';

export const metadata: Metadata = { title: 'Auditoría de simulaciones' };
export const dynamic = 'force-dynamic';

export default async function AdminSimulationsPage() {
  const auth = await getAuth();
  if (!auth || !can(auth.user.role, 'simulations:audit')) redirect('/panel');

  const [recent, engineVersions, providers, accounts] = await Promise.all([
    db.simulation.findMany({
      orderBy: { openedAt: 'desc' },
      take: 40,
      include: { user: { select: { email: true, name: true } } },
    }),
    db.simulation.groupBy({ by: ['engineVersion'], _count: { _all: true } }),
    db.simulation.groupBy({ by: ['priceSourceProvider'], _count: { _all: true } }),
    db.demoAccount.findMany({
      take: 50,
      include: { ledger: { orderBy: { createdAt: 'asc' } }, user: { select: { email: true } } },
    }),
  ]);

  // Verificación de integridad del libro mayor de cada cuenta muestreada.
  const integrity = accounts.map((a) => {
    const check = verifyLedger(
      a.ledger.map((l) => ({
        amountCents: l.amountCents,
        balanceAfterCents: l.balanceAfterCents,
        reason: l.reason as never,
        createdAt: l.createdAt,
      })),
    );
    return {
      email: a.user.email,
      ok: check.ok && check.computedBalanceCents === a.balanceCents,
      stored: a.balanceCents,
      computed: check.computedBalanceCents,
      entries: a.ledger.length,
    };
  });

  const brokenAccounts = integrity.filter((i) => !i.ok);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Auditoría de simulaciones</h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[var(--color-muted)]">
          Cada simulación guarda el precio de entrada y salida con su proveedor y marca temporal, la latencia, los
          indicadores congelados, la versión del motor y la traza de cálculo del cierre. Con esos datos, cualquier
          resultado puede recalcularse y verificarse meses después.
        </p>
      </header>

      {brokenAccounts.length > 0 ? (
        <Callout tone="danger" title="Divergencia detectada en el libro mayor">
          {brokenAccounts.length} cuenta(s) muestreada(s) presentan un saldo que no coincide con la suma de sus
          asientos. Esto no debería ocurrir nunca: revisa el registro de auditoría y las transacciones recientes.
        </Callout>
      ) : (
        <Callout tone="success" title="Integridad verificada">
          En la muestra de {integrity.length} cuentas, el saldo almacenado coincide exactamente con la suma de los
          asientos de su libro mayor.
        </Callout>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Versiones del motor en uso</h2>
          <ul className="mt-3 space-y-1.5">
            {engineVersions.map((v) => (
              <li key={v.engineVersion} className="flex justify-between text-[13px]">
                <span className="num text-[var(--color-muted)]">{v.engineVersion}</span>
                <span className="num">{v._count._all} simulaciones</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Proveedores de precio utilizados</h2>
          <ul className="mt-3 space-y-1.5">
            {providers.map((p) => (
              <li key={p.priceSourceProvider} className="flex justify-between text-[13px]">
                <span className="num text-[var(--color-muted)]">{p.priceSourceProvider}</span>
                <span className="num">{p._count._all} simulaciones</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-[14px] font-semibold">Últimas simulaciones</h2>
        </div>
        <table className="w-full min-w-[60rem] text-[12px]">
          <caption className="sr-only">Últimas simulaciones registradas</caption>
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Usuario</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Instrumento</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Modo</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Entrada</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Salida</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Resultado</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Proveedor</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Latencia</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Motor</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Apertura</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((s) => (
              <tr key={s.id} className="border-b border-[var(--color-border)] last:border-0 align-top">
                <td className="px-4 py-2.5 text-[11px] text-[var(--color-muted)]">{s.user.email}</td>
                <td className="num px-4 py-2.5 font-medium">{s.symbol}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={s.mode === 'HYPOTHESIS' ? 'blue' : 'violet'}>{s.mode}</Badge>
                </td>
                <td className="num px-4 py-2.5 text-right">{s.entryPrice}</td>
                <td className="num px-4 py-2.5 text-right">{s.exitPrice ?? '—'}</td>
                <td
                  className={`num px-4 py-2.5 text-right ${
                    (s.pnlCents ?? 0) > 0
                      ? 'text-[var(--color-positive)]'
                      : (s.pnlCents ?? 0) < 0
                        ? 'text-[var(--color-negative)]'
                        : ''
                  }`}
                >
                  {s.pnlCents != null ? formatVirtualUsd(s.pnlCents) : 'abierta'}
                </td>
                <td className="num px-4 py-2.5 text-[11px] text-[var(--color-muted)]">{s.priceSourceProvider}</td>
                <td className="num px-4 py-2.5 text-right text-[11px] text-[var(--color-muted)]">
                  {s.entryLatencyMs} ms
                </td>
                <td className="num px-4 py-2.5 text-[11px] text-[var(--color-muted)]">{s.engineVersion}</td>
                <td className="px-4 py-2.5 text-[11px] text-[var(--color-muted)]">
                  {formatDateTime(s.openedAt, auth.user.timezone)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Integridad del libro mayor (muestra)</h2>
        <ul className="mt-3 space-y-1.5">
          {integrity.slice(0, 15).map((i) => (
            <li key={i.email} className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">{i.email}</span>
              <span className="num text-[var(--color-subtle)]">{i.entries} asientos</span>
              <span className="num">{formatVirtualUsd(i.stored)}</span>
              <Badge tone={i.ok ? 'positive' : 'negative'}>{i.ok ? 'Coincide' : 'Divergencia'}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
