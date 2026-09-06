'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useMotionPreference } from '@/components/pwa/useMotionPreference';
import { isStandalone } from '@/components/pwa/appMode';
import { useTheme } from '@tl/ui/ThemeProvider';
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
  Search,
  Command,
  ArrowUpRight,
  Compass,
  WalletCards,
} from 'lucide-react';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
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
  { href: '/panel', label: 'Resumen', icon: LayoutDashboard },
  { href: '/explorar', label: 'Explorar', icon: Compass },
  { href: '/terminal', label: 'Trading', icon: CandlestickChart },
  { href: '/portafolio', label: 'Portafolio', icon: WalletCards },
  { href: '/academia', label: 'Academia', icon: GraduationCap },
];

const NAV_SECONDARY = [
  { href: '/diario', label: 'Diario', icon: NotebookPen },
  { href: '/estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { href: '/entrenador', label: 'Entrenador IA', icon: Sparkles },
  { href: '/retos', label: 'Retos', icon: Trophy },
  { href: '/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/noticias', label: 'Artículos', icon: Newspaper },
];

const MOBILE_TABS = [
  { href: '/panel', label: 'Inicio', icon: LayoutDashboard },
  { href: '/explorar', label: 'Mercados', icon: Compass },
  { href: '/terminal', label: 'Practicar', icon: CandlestickChart },
  { href: '/academia', label: 'Aprender', icon: GraduationCap },
  { href: '/perfil', label: 'Cuenta', icon: Settings },
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
  const systemReducedMotion = useMotionPreference();
  const { reduceMotion } = useTheme();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);

  const isAdmin = ADMIN_ROLES.includes(user.role);
  const immersive = IMMERSIVE_ROUTES.some((r) => pathname.startsWith(r));

  React.useEffect(() => {
    setMenuOpen(false);
    setNotifOpen(false);
    setCommandOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (event.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace(isStandalone() ? '/app' : '/');
    router.refresh();
  }

  return (
    <div data-app-flow={pathname.startsWith('/onboarding') ? 'onboarding' : 'workspace'} className="app-shell min-h-dvh bg-[var(--color-bg)] lg:flex">
      {/* ── Barra lateral (escritorio) ──────────────────────────────────── */}
      <aside className="app-sidebar hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] lg:flex">
        <div className="app-brand-block px-5 py-6">
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

        <div className="border-t border-[var(--color-border)] p-4">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-blue-soft)] text-[11px] font-semibold text-[var(--color-blue)]">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{user.name}</span>
              <Link href="/precios" className="block text-[11px] text-[var(--color-blue)]">TradingLab {PLAN_ENTITLEMENTS[user.plan].name} ↗</Link>
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
      <div className="app-workspace flex min-w-0 flex-1 flex-col">
        {/* Cabecera móvil */}
        <header className="app-mobile-header sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-[var(--color-border)] px-4 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="flex size-9 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-muted)]"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <Link className="app-header-brand" href="/panel" aria-label="Ir al panel">
            <Logo size="sm" withWordmark={false} />
          </Link>
          <span className="native-toolbar-title">{pathname === '/panel' ? 'TradingLab' : pathname === '/explorar' ? 'Mercados' : pathname === '/portafolio' ? 'Portafolio' : BREADCRUMB_LABELS[pathname.split('/')[1]] ?? 'TradingLab'}</span>

          <span className="app-header-balance num ml-auto flex items-center gap-1.5 text-[13px] font-semibold">
            {(balanceCents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <DemoBadge />
          </span>

          <NotificationsButton
            count={notifications.length}
            open={notifOpen}
            onToggle={() => setNotifOpen((v) => !v)}
          />
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            aria-label="Abrir búsqueda"
            className="flex size-9 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-muted)]"
          >
            <Search className="size-4" aria-hidden="true" />
          </button>
        </header>

        {/* Barra superior de escritorio */}
        <header className="app-topbar sticky top-0 z-30 hidden h-16 items-center gap-4 border-b border-[var(--color-border)] px-8 backdrop-blur-xl lg:flex">
          <Breadcrumb pathname={pathname} />
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="app-command-trigger hidden items-center gap-3 rounded-full border border-[var(--color-border)] px-3 py-2 text-left text-[11px] text-[var(--color-muted)] xl:flex"
            >
              <Search className="size-3.5" aria-hidden="true" />
              <span className="w-40">Buscar en TradingLab</span>
              <kbd className="app-keycap"><Command className="size-3" aria-hidden="true" />K</kbd>
            </button>
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
        {commandOpen && <CommandPalette pathname={pathname} onClose={() => setCommandOpen(false)} />}

        <main id="contenido" className={cn('min-w-0 flex-1', !immersive && 'pb-20 lg:pb-0')}>
          {children}
        </main>

        {/* Barra inferior móvil. Nunca coexiste con otra barra de navegación. */}
        {!immersive && (
          <nav
            aria-label="Navegación rápida"
            className="app-mobile-nav fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_94%,transparent)] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_-20px_var(--color-text)] backdrop-blur-xl lg:hidden"
          >
            {MOBILE_TABS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'app-mobile-nav-item flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                    active ? 'text-[var(--color-blue)]' : 'text-[var(--color-muted)]',
                  )}
                >
                  {active && <motion.span className="app-mobile-nav-selection" layoutId="mobile-active-tab" transition={systemReducedMotion || reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }} aria-hidden="true" />}
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
        <MobileMenu onClose={() => setMenuOpen(false)}>
            <div className="flex items-center justify-between px-5 py-5">
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
        </MobileMenu>
      )}
    </div>
  );
}

/** Native dialog supplies focus containment, Escape and focus restoration. */
function MobileMenu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const reduce = useMotionPreference();
  React.useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} aria-label="Todas las secciones" className="app-menu-sheet" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div className="app-menu-sheet-content" initial={reduce ? false : { y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 32, stiffness: 300 }}>
      <span className="app-sheet-handle" aria-hidden="true" />{children}
    </motion.div>
  </dialog>;
}

function BalanceCard({ cents }: { cents: number }) {
  return (
    <div className="app-balance-card mx-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
          Saldo virtual
        </span>
        <DemoBadge />
      </div>
          <p className="num mt-2 text-xl font-semibold tracking-tight">
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
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
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
                  'app-nav-link flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[13px] font-medium transition-colors',
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

const COMMAND_ITEMS = [
  ...NAV_PRIMARY,
  ...NAV_SECONDARY,
  ...NAV_FOOTER,
];

function CommandPalette({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const filtered = COMMAND_ITEMS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  React.useEffect(() => inputRef.current?.focus(), []);
  React.useEffect(() => setActiveIndex(0), [query]);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter' && filtered[activeIndex]) {
      event.preventDefault();
      router.push(filtered[activeIndex].href);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[70]" role="presentation" onClick={onClose}>
      <div className="app-command-backdrop absolute inset-0" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en TradingLab"
        onClick={(event) => event.stopPropagation()}
        className="app-command-panel absolute left-1/2 top-[14vh] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-strong)] shadow-[var(--shadow-lifted)]"
      >
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <Search className="size-4 text-[var(--color-muted)]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Buscar una sección..."
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-subtle)]"
          />
          <kbd className="app-keycap">Esc</kbd>
        </div>
        <div className="p-2">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-subtle)]">Navegar</p>
          <ul className="max-h-[min(24rem,52vh)] overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-8 text-center text-[13px] text-[var(--color-muted)]">No encontramos esa sección.</li>
            ) : (
              filtered.map((item, index) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const highlighted = index === activeIndex;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-[13px] transition-colors',
                        highlighted ? 'bg-[var(--color-overlay)] text-[var(--color-text)]' : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-text)]',
                        active && 'text-[var(--color-blue)]',
                      )}
                    >
                      <item.icon className="size-4" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      <ArrowUpRight className="size-3.5 opacity-45" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
        <div className="border-t border-[var(--color-border)] px-4 py-2.5 text-[10px] text-[var(--color-subtle)]">
          Usa ↑ ↓ para navegar · Enter para abrir · Esc para cerrar
        </div>
      </div>
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
