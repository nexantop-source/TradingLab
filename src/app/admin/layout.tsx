import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { can, ROLE_LABEL } from '@/lib/rbac';
import { Logo } from '@/components/Logo';
import { Badge } from '@tl/ui';
import { AdminNav } from './AdminNav';
import { ADMIN_SECTIONS } from './sections';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');
  if (!can(auth.user.role, 'admin:access')) redirect('/panel');

  const sections = ADMIN_SECTIONS.filter((s) => can(auth.user.role, s.permission));

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex">
        <div className="px-4 py-5">
          <Link href="/panel" aria-label="Volver a la aplicación">
            <Logo size="sm" />
          </Link>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
            Panel administrativo
          </p>
        </div>

        <AdminNav sections={sections} />

        <div className="border-t border-[var(--color-border)] p-4">
          <p className="text-[12px] font-medium">{auth.user.name}</p>
          <Badge tone="violet" className="mt-1.5">
            {ROLE_LABEL[auth.user.role]}
          </Badge>
          <Link
            href="/panel"
            className="mt-3 block text-[12px] text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            ← Volver a la aplicación
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 lg:hidden">
          <AdminNav sections={sections} horizontal />
        </div>
        <main id="contenido" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
