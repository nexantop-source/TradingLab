'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button, cn } from '@tl/ui';

const NAV = [
  { href: '/mercados', label: 'Mercados' },
  { href: '/#producto', label: 'Plataforma' },
  { href: '/recursos', label: 'Aprender' },
  { href: '/precios', label: 'Planes' },
];

/**
 * Cabecera pública de orientación: compacta, estable y centrada en tareas.
 */
export function MarketingHeader({ authenticated = false }: { authenticated?: boolean }) {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          'marketing-nav-shell mx-auto flex max-w-6xl items-center gap-4 px-5 transition-all duration-300 ease-[var(--ease-out-soft)] sm:px-8',
          scrolled
            ? 'h-12 bg-[color-mix(in_srgb,var(--color-surface)_78%,transparent)] backdrop-blur-2xl'
            : 'h-14 bg-[color-mix(in_srgb,var(--color-surface)_62%,transparent)] backdrop-blur-xl',
        )}
      >
        <Link href="/" className="shrink-0" aria-label="TradingLab, ir al inicio">
          <Logo size="sm" />
        </Link>

        <nav aria-label="Navegación principal" className="hidden flex-1 items-center gap-0.5 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-[12px] font-medium text-[var(--color-text)] transition-opacity hover:opacity-55"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {authenticated ? (
            <Link href="/panel">
              <Button size="sm" className="rounded-[10px] px-4">Ir a mi panel</Button>
            </Link>
          ) : (
            <>
              <Link href="/entrar" className="hidden sm:block">
                <Button variant="ghost" size="sm" className="rounded-[10px]">
                  Iniciar sesión
                </Button>
              </Link>
              <Link href="/crear-cuenta">
                <Button size="sm" className="rounded-[10px] px-4">Empezar gratis</Button>
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            className="flex size-9 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-muted)] lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="menu-movil"
          className="animate-fade-up mx-3 mt-2 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_92%,transparent)] p-3 shadow-[var(--shadow-lifted)] backdrop-blur-2xl lg:hidden"
        >
          <nav aria-label="Navegación móvil" className="flex flex-col">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-[var(--radius-sm)] px-3 py-3 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-text)]"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-[var(--color-border)] pt-2">
              <Link
                href="/entrar"
                onClick={() => setOpen(false)}
                className="block rounded-[var(--radius-sm)] px-3 py-3 text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                Iniciar sesión
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
