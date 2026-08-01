import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { Badge, Card, EmptyState } from '@tl/ui';
import { formatDateTime } from '@/lib/format';
import { LifeBuoy } from 'lucide-react';

export const metadata: Metadata = { title: 'Soporte' };
export const dynamic = 'force-dynamic';

export default async function AdminSupportPage() {
  const auth = await getAuth();
  if (!auth || !can(auth.user.role, 'support:read')) redirect('/panel');

  const tickets = await db.supportTicket.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: 60,
    include: { user: { select: { email: true, name: true } } },
  });

  const byStatus = tickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Soporte</h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-muted)]">
          {tickets.length} tickets. Los avisos de posible fraude y los usuarios Premium entran con prioridad alta.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {Object.entries(byStatus).map(([status, count]) => (
          <Badge key={status} tone={status === 'OPEN' ? 'gold' : 'neutral'}>
            {status}: {count}
          </Badge>
        ))}
      </div>

      {tickets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LifeBuoy className="size-5" />}
            title="No hay tickets"
            description="Las consultas enviadas desde el centro de ayuda aparecerán aquí."
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <details className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
                  <Badge tone={t.priority === 'HIGH' ? 'negative' : 'neutral'}>{t.category}</Badge>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.subject}</span>
                  <span className="text-[11px] text-[var(--color-subtle)]">{t.user.email}</span>
                  <Badge tone={t.status === 'OPEN' ? 'gold' : 'positive'}>{t.status}</Badge>
                </summary>
                <div className="border-t border-[var(--color-border)] px-4 py-3">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--color-muted)]">
                    {t.body}
                  </p>
                  <p className="mt-3 text-[11px] text-[var(--color-subtle)]">
                    Recibido el {formatDateTime(t.createdAt, auth.user.timezone)}
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
