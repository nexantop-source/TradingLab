import { cn } from '@tl/ui';

/**
 * Marca de TradingLab: una ventana limpia sobre el proceso de decisión.
 * El trazo ascendente representa aprendizaje, no rentabilidad prometida.
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
          <linearGradient id="tl-mark" x1="9" y1="55" x2="55" y2="8" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0071E3" />
            <stop offset="1" stopColor="#56B4FF" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill="url(#tl-mark)" />
        <rect x="1" y="1" width="62" height="62" rx="17" fill="none" stroke="#FFFFFF4D" strokeWidth="2" />
        <path
          d="M15 42L27 31L36 37L49 20"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="49" cy="20" r="4.5" fill="#FFFFFF" />
      </svg>
      {withWordmark && (
        <span className={cn('font-semibold tracking-[-0.045em]', text)}>TradingLab</span>
      )}
    </span>
  );
}
