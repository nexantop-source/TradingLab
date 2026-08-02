import { redirect } from 'next/navigation';
import { getAuth, touchActivity } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensureDemoAccount } from '@/lib/demo-account';
import { ThemeProvider } from '@tl/ui/ThemeProvider';
import { AppShell } from '@/components/app/AppShell';
import type { ThemeId } from '@tl/types';

/**
 * Todo lo que cuelga de este layout depende de la sesión, así que nada puede
 * cachearse. Se declara aquí y no en cada página: una página nueva que se
 * olvide de declararlo quedaría cacheada con el estado de otro usuario, y ese
 * fallo es silencioso hasta que alguien ve datos que no son suyos.
 */
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  await touchActivity(auth.user.id);

  const [profile, account, notifications] = await Promise.all([
    db.profile.findUnique({ where: { userId: auth.user.id } }),
    ensureDemoAccount(auth.user.id),
    db.notification.findMany({
      where: { userId: auth.user.id, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  return (
    <ThemeProvider
      initialTheme={(profile?.theme ?? 'system') as ThemeId}
      initialReduceMotion={profile?.reduceMotion ?? false}
      persistToServer
    >
      <AppShell
        user={auth.user}
        balanceCents={account.balanceCents}
        notifications={notifications.map((n) => ({
          id: n.id,
          kind: n.kind,
          title: n.title,
          body: n.body,
          href: n.href,
          createdAt: n.createdAt.toISOString(),
        }))}
      >
        {children}
      </AppShell>
    </ThemeProvider>
  );
}
