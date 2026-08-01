import { cn } from '@tl/ui';

/**
 * Marca de TradingLab.
 *
 * Diseño original: un trazo ascendente escalonado que evoca progresión de
 * aprendizaje, no una vela de precios. Deliberadamente distinto de las marcas
 * de plataformas de trading existentes.
 */
export function Logo({
  size = 'md',
  withWordmark = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  withWordmark?: boolean;
  className?: string;
}) {
  const dims = { sm: 24, md: 30, lg: 38 }[size];
  const text = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' }[size];

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width={dims}
        height={dims}
        viewBox="0 0 64 64"
        fill="none"
        role="img"
        aria-label="TradingLab"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="tl-logo-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-blue)" />
            <stop offset="55%" stopColor="var(--color-violet)" />
            <stop offset="100%" stopColor="var(--color-positive)" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="var(--color-elevated)" />
        <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" fill="none" stroke="var(--color-border-strong)" />
        <path
          d="M14 44 L24 34 L32 40 L50 20"
          fill="none"
          stroke="url(#tl-logo-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="20" r="4.5" fill="var(--color-positive)" />
        <rect x="13" y="47" width="38" height="3" rx="1.5" fill="var(--color-border-strong)" />
      </svg>
      {withWordmark && (
        <span className={cn('font-semibold tracking-[-0.02em]', text)}>
          Broker<span className="text-[var(--color-muted)]">Capital</span>
        </span>
      )}
    </span>
  );
}
