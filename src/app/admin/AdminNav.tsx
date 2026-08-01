'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@tl/ui';

export function AdminNav({
  sections,
  horizontal,
}: {
  sections: Array<{ href: string; label: string }>;
  horizontal?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones administrativas"
      className={cn(horizontal ? 'flex gap-1 overflow-x-auto' : 'flex-1 space-y-0.5 overflow-y-auto px-3 py-2')}
    >
      {sections.map((s) => {
        const active = s.href === '/admin' ? pathname === '/admin' : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] font-medium transition-colors',
              horizontal ? 'shrink-0 whitespace-nowrap' : 'block',
              active
                ? 'bg-[var(--color-violet-soft)] text-[var(--color-violet)]'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-text)]',
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
