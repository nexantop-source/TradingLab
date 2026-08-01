import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { Badge, Card, Input } from '@tl/ui';
import { formatDateTime, formatVirtualUsd } from '@/lib/format';

export const metadata: Metadata = { title: 'Usuarios' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; estado?: string }>;
}) {
  const auth = await getAuth();
  if (!auth || !can(auth.user.role, 'users:read')) redirect('/panel');

  const params = await searchParams;
  const q = params.q?.trim() ?? '';

  const users = await db.user.findMany({
    where: {
      ...(q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {}),
      ...(params.estado ? { status: params.estado } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: {
      subscription: { select: { planId: true, status: true } },
      profile: { select: { experienceLevel: true } },
      demoAccounts: { select: { balanceCents: true }, take: 1 },
      _count: { select: { simulations: true, journalEntries: true, aiAnalyses: true } },
    },
  });

  const filtered = params.plan
    ? users.filter((u) => (u.subscription?.planId ?? 'FREE') === params.plan)
    : users;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Usuarios</h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
          {filtered.length} resultados. Los datos personales se muestran solo a los roles autorizados y todo
          acceso queda registrado en el registro de auditoría.
        </p>
      </header>

      <Card className="p-4">
        <form method="get" className="flex flex-wrap gap-2">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o correo"
            aria-label="Buscar usuarios"
            className="h-9 max-w-xs"
          />
          <select
            name="plan"
            defaultValue={params.plan ?? ''}
            aria-label="Filtrar por plan"
            className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 text-[13px]"
          >
            <option value="">Todos los planes</option>
            <option value="FREE">Free</option>
            <option value="STANDARD">Standard</option>
            <option value="PREMIUM">Premium</option>
          </select>
          <select
            name="estado"
            defaultValue={params.estado ?? ''}
            aria-label="Filtrar por estado"
            className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 text-[13px]"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="SUSPENDED">Suspendidos</option>
          </select>
          <button
            type="submit"
            className="h-9 rounded-[var(--radius-sm)] bg-[var(--color-blue)] px-4 text-[13px] font-medium text-white"
          >
            Filtrar
          </button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-[13px]">
          <caption className="sr-only">Listado de usuarios</caption>
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Usuario</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Plan</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Nivel</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Saldo DEMO</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Simulaciones</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Diario</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">IA</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Última actividad</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-4 py-3">
                  <span className="block font-medium">{u.name}</span>
                  <span className="block text-[11px] text-[var(--color-subtle)]">{u.email}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    tone={
                      u.subscription?.planId === 'PREMIUM'
                        ? 'violet'
                        : u.subscription?.planId === 'STANDARD'
                          ? 'blue'
                          : 'neutral'
                    }
                  >
                    {u.subscription?.planId ?? 'FREE'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-[12px] text-[var(--color-muted)]">
                  {u.profile?.experienceLevel ?? '—'}
                </td>
                <td className="num px-4 py-3 text-right">
                  {u.demoAccounts[0] ? formatVirtualUsd(u.demoAccounts[0].balanceCents) : '—'}
                </td>
                <td className="num px-4 py-3 text-right">{u._count.simulations}</td>
                <td className="num px-4 py-3 text-right">{u._count.journalEntries}</td>
                <td className="num px-4 py-3 text-right">{u._count.aiAnalyses}</td>
                <td className="px-4 py-3 text-[11px] text-[var(--color-muted)]">
                  {u.lastSeenAt ? formatDateTime(u.lastSeenAt, auth.user.timezone) : 'Nunca'}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={u.status === 'ACTIVE' ? 'positive' : 'negative'}>{u.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-[11px] leading-relaxed text-[var(--color-subtle)]">
        El saldo DEMO se expresa en dólares virtuales (VUSD) y no tiene valor económico. La rentabilidad virtual
        de un estudiante no se utiliza como indicador de calidad ni de riesgo.
      </p>
    </div>
  );
}
