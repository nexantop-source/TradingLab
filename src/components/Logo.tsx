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
        viewBox="100 70 800 860"
        fill="none"
        role="img"
        aria-label="TradingLab"
        className="shrink-0"
      >
        <path fill="currentColor" d="M180 390 C180 360 195 335 220 318 L548 100 C580 79 620 101 620 140 L620 300 C620 324 610 345 590 360 L500 405 L395 500 L240 615 C214 633 180 615 180 583 Z M500 405 L605 500 L617 491 L518 396 Z" />
        <path fill="currentColor" d="M820 610 C820 640 805 665 780 682 L452 900 C420 921 380 899 380 860 L380 700 C380 676 390 655 410 640 L500 595 L605 500 L760 385 C786 367 820 385 820 417 Z M500 595 L395 500 L383 509 L482 604 Z" />
      </svg>
      {withWordmark && (
        <span className={cn('font-semibold tracking-[-0.045em]', text)}>TradingLab</span>
      )}
    </span>
  );
}
