import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { can, ROLE_LABEL } from '@/lib/rbac';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import { Badge, Card, EmptyState } from '@tl/ui';
import { formatDateTime } from '@/lib/format';
import { ScrollText } from 'lucide-react';
import type { Role } from '@tl/types';

export const metadata: Metadata = { title: 'Registro de auditoría' };
export const dynamic = 'force-dynamic';

export default async function AdminAuditPage() {
  const auth = await getAuth();
  if (!auth || !can(auth.user.role, 'audit:read')) redirect('/panel');

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { actor: { select: { email: true, name: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Registro de auditoría</h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[var(--color-muted)]">
          Toda acción administrativa que modifica datos queda registrada aquí con su autor, su rol, la entidad
          afectada y el estado anterior y posterior. Las direcciones IP se almacenan como valor derivado
          irreversible, nunca en claro.
        </p>
      </header>

      {logs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ScrollText className="size-5" />}
            title="Sin entradas de auditoría"
            description="Las acciones administrativas que modifiquen datos aparecerán aquí de forma inmutable."
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--color-border)]">
            {logs.map((log) => (
              <li key={log.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="violet">{log.action}</Badge>
                  <span className="num text-[12px]">{log.entity}</span>
                  {log.entityId && (
                    <span className="num text-[11px] text-[var(--color-subtle)]">{log.entityId}</span>
                  )}
                  <span className="ml-auto text-[11px] text-[var(--color-subtle)]">
                    {formatDateTime(log.createdAt, auth.user.timezone)}
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] text-[var(--color-muted)]">
                  {log.actor?.email ?? 'sistema'}
                  {log.actorRole && ` · ${ROLE_LABEL[log.actorRole as Role] ?? log.actorRole}`}
                </p>
                {log.diff !== '{}' && (
                  <pre className="num mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-[var(--radius-xs)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-[10px] leading-relaxed text-[var(--color-subtle)]">
                    {JSON.stringify(fromJson(log.diff, {}), null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
