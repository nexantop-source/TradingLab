'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button, cn } from '@tl/ui';

const NAV = [
  { href: '/#simulador', label: 'Simulador' },
  // La academia completa exige cuenta; la vista pública vive en /recursos.
  { href: '/recursos', label: 'Academia' },
  { href: '/#como-funciona', label: 'Cómo funciona' },
  { href: '/mercados', label: 'Mercados' },
  { href: '/precios', label: 'Precios' },
];

/**
 * Cabecera pública flotante y translúcida.
 * Se compacta suavemente al desplazarse, sin saltos bruscos de altura.
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
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <div
        className={cn(
          'mx-auto flex max-w-7xl items-center gap-4 rounded-full px-4 transition-all duration-300 ease-[var(--ease-out-soft)] sm:px-5',
          scrolled
            ? 'h-13 border border-[var(--color-border-strong)] bg-[color-mix(in_srgb,var(--color-surface)_86%,transparent)] shadow-[var(--shadow-soft)] backdrop-blur-xl'
            : 'h-15 border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_48%,transparent)] backdrop-blur-md',
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
              className="rounded-full px-3 py-2 text-[12px] font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-text)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {authenticated ? (
            <Link href="/panel">
              <Button size="sm" className="rounded-full px-4">Ir a mi panel</Button>
            </Link>
          ) : (
            <>
              <Link href="/entrar" className="hidden sm:block">
                <Button variant="ghost" size="sm" className="rounded-full">
                  Iniciar sesión
                </Button>
              </Link>
              <Link href="/crear-cuenta">
                <Button size="sm" className="rounded-full px-4">Comenzar gratis</Button>
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
          className="animate-fade-up mx-auto mt-2 max-w-6xl rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 shadow-[var(--shadow-lifted)] lg:hidden"
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
