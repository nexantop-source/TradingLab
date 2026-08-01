'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CandlestickChart,
  GraduationCap,
  NotebookPen,
  BarChart3,
  Trophy,
  CalendarDays,
  Newspaper,
  Sparkles,
  Settings,
  LifeBuoy,
  Bell,
  LogOut,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Badge, Button, cn } from '@tl/ui';
import { DemoBadge } from '@tl/ui/compliance';
import type { SessionUser } from '@tl/types';
import { ADMIN_ROLES } from '@tl/types';
import { apiFetch } from '@/lib/client-api';

interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
}

const NAV_PRIMARY = [
  { href: '/panel', label: 'Panel', icon: LayoutDashboard },
  { href: '/terminal', label: 'Terminal', icon: CandlestickChart },
  { href: '/academia', label: 'Academia', icon: GraduationCap },
  { href: '/diario', label: 'Diario', icon: NotebookPen },
  { href: '/estadisticas', label: 'Estadísticas', icon: BarChart3 },
];

const NAV_SECONDARY = [
  { href: '/entrenador', label: 'Entrenador IA', icon: Sparkles },
  { href: '/retos', label: 'Retos', icon: Trophy },
  { href: '/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/noticias', label: 'Artículos', icon: Newspaper },
];

const NAV_FOOTER = [
  { href: '/perfil', label: 'Perfil y ajustes', icon: Settings },
  { href: '/ayuda', label: 'Centro de ayuda', icon: LifeBuoy },
];

/** Rutas donde la barra inferior móvil estorba y se oculta. */
const IMMERSIVE_ROUTES = ['/terminal'];

export function AppShell({
  user,
  balanceCents,
  notifications,
  children,
}: {
  user: SessionUser;
  balanceCents: number;
  notifications: NotificationItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);

  const isAdmin = ADMIN_ROLES.includes(user.role);
  const immersive = IMMERSIVE_ROUTES.some((r) => pathname.startsWith(r));

  React.useEffect(() => {
    setMenuOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-dvh lg:flex">
      {/* ── Barra lateral (escritorio) ──────────────────────────────────── */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex">
        <div className="px-4 py-5">
          <Link href="/panel" aria-label="Ir al panel">
            <Logo size="sm" />
          </Link>
        </div>

        <BalanceCard cents={balanceCents} />

        <nav aria-label="Navegación principal" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <NavGroup items={NAV_PRIMARY} pathname={pathname} />
          <NavGroup title="Explorar" items={NAV_SECONDARY} pathname={pathname} />
          <NavGroup title="Cuenta" items={NAV_FOOTER} pathname={pathname} />
          {isAdmin && (
            <NavGroup
              title="Administración"
              items={[{ href: '/admin', label: 'Panel administrativo', icon: ShieldCheck }]}
              pathname={pathname}
            />
          )}
        </nav>

        <div className="border-t border-[var(--color-border)] p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-blue-soft)] text-[11px] font-semibold text-[var(--color-blue)]">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{user.name}</span>
              <span className="block text-[10px] text-[var(--color-subtle)]">Plan {user.plan}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 text-[13px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-text)]"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido ───────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera móvil */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] px-4 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="flex size-9 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-muted)]"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <Link href="/panel" aria-label="Ir al panel">
            <Logo size="sm" withWordmark={false} />
          </Link>

          <span className="num ml-auto flex items-center gap-1.5 text-[13px] font-semibold">
            {(balanceCents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <DemoBadge />
          </span>

          <NotificationsButton
            count={notifications.length}
            open={notifOpen}
            onToggle={() => setNotifOpen((v) => !v)}
          />
        </header>

        {/* Barra superior de escritorio */}
        <header className="sticky top-0 z-30 hidden h-14 items-center gap-4 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] px-6 backdrop-blur-xl lg:flex">
          <Breadcrumb pathname={pathname} />
          <div className="ml-auto flex items-center gap-3">
            {user.plan === 'FREE' && (
              <Link href="/precios">
                <Button size="sm" variant="outline">
                  Ver planes
                </Button>
              </Link>
            )}
            <NotificationsButton
              count={notifications.length}
              open={notifOpen}
              onToggle={() => setNotifOpen((v) => !v)}
            />
          </div>
        </header>

        {notifOpen && <NotificationsPanel items={notifications} onClose={() => setNotifOpen(false)} />}

        <main id="contenido" className={cn('min-w-0 flex-1', !immersive && 'pb-20 lg:pb-0')}>
          {children}
        </main>

        {/* Barra inferior móvil. Nunca coexiste con otra barra de navegación. */}
        {!immersive && (
          <nav
            aria-label="Navegación rápida"
            className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_94%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
          >
            {NAV_PRIMARY.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                    active ? 'text-[var(--color-blue)]' : 'text-[var(--color-muted)]',
                  )}
                >
                  <item.icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* Menú lateral móvil */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="animate-fade-up relative h-full w-72 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-center justify-between px-4 py-4">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Cerrar menú"
                className="flex size-8 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-muted)]"
              >
                <X className="size-5" />
              </button>
            </div>
            <BalanceCard cents={balanceCents} />
            <nav aria-label="Menú completo" className="space-y-6 px-3 py-4">
              <NavGroup items={NAV_PRIMARY} pathname={pathname} />
              <NavGroup title="Explorar" items={NAV_SECONDARY} pathname={pathname} />
              <NavGroup title="Cuenta" items={NAV_FOOTER} pathname={pathname} />
              {isAdmin && (
                <NavGroup
                  title="Administración"
                  items={[{ href: '/admin', label: 'Panel administrativo', icon: ShieldCheck }]}
                  pathname={pathname}
                />
              )}
            </nav>
            <div className="border-t border-[var(--color-border)] p-3">
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2.5 text-[13px] text-[var(--color-muted)]"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BalanceCard({ cents }: { cents: number }) {
  return (
    <div className="mx-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
          Saldo virtual
        </span>
        <DemoBadge />
      </div>
      <p className="num mt-1.5 text-lg font-semibold tracking-tight">
        <span className="text-[var(--color-muted)]">USD </span>
        {(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className="mt-1 text-[10px] leading-snug text-[var(--color-subtle)]">
        No es dinero real y no puede retirarse.
      </p>
    </div>
  );
}

function NavGroup({
  title,
  items,
  pathname,
}: {
  title?: string;
  items: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
  pathname: string;
}) {
  return (
    <div>
      {title && (
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
          {title}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-[var(--color-blue-soft)] text-[var(--color-blue)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-text)]',
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const BREADCRUMB_LABELS: Record<string, string> = {
  panel: 'Panel',
  terminal: 'Terminal de simulación',
  academia: 'Academia',
  diario: 'Diario educativo',
  estadisticas: 'Estadísticas',
  entrenador: 'Entrenador IA',
  retos: 'Retos',
  calendario: 'Calendario económico',
  noticias: 'Artículos educativos',
  perfil: 'Perfil y ajustes',
  ayuda: 'Centro de ayuda',
  onboarding: 'Configuración inicial',
};

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);
  const label = BREADCRUMB_LABELS[segments[0] ?? ''] ?? 'TradingLab';
  return (
    <div className="flex items-center gap-2">
      <h1 className="text-[13px] font-semibold">{label}</h1>
      {segments.length > 1 && (
        <span className="text-[12px] text-[var(--color-subtle)]">/ {decodeURIComponent(segments[1])}</span>
      )}
    </div>
  );
}

function NotificationsButton({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={count > 0 ? `Notificaciones, ${count} sin leer` : 'Notificaciones'}
      className="relative flex size-9 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
    >
      <Bell className="size-4.5" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-[var(--color-blue)] text-[9px] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

function NotificationsPanel({ items, onClose }: { items: NotificationItem[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        role="dialog"
        aria-label="Notificaciones"
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up absolute right-3 top-16 w-80 max-w-[calc(100vw-1.5rem)] rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-elevated)] shadow-[var(--shadow-lifted)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-[13px] font-semibold">Notificaciones</h2>
          <Badge tone="blue">{items.length}</Badge>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-[var(--color-muted)]">
            No tienes notificaciones pendientes.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-[var(--color-border)] overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.href ?? '#'} className="block px-4 py-3 hover:bg-[var(--color-overlay)]">
                  <p className="text-[13px] font-medium">{n.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">{n.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
