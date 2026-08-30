import Link from 'next/link';
import { cn } from '@tl/ui';

/** Relleno propio, contextual y sin seguimiento que conserva la geometría. */
export function HouseAd({
  code,
  minHeight,
  className,
}: {
  code: string;
  minHeight: number;
  className?: string;
}) {
  const academyContext = code.includes('academy') || code.includes('lesson');
  const publicContext = code === 'public-banner';
  const href = publicContext ? '/crear-cuenta' : academyContext ? '/academia' : '/diario';
  const headline = publicContext
    ? 'Practica decisiones de mercado sin arriesgar dinero'
    : academyContext
      ? 'Continúa tu ruta de aprendizaje'
      : 'Convierte una operación en una lección';
  const body = publicContext
    ? 'Abre una cuenta educativa y empieza con saldo 100 % virtual.'
    : academyContext
      ? 'Retoma el siguiente módulo sin salir de tu entorno educativo.'
      : 'Documenta tu hipótesis, el riesgo asumido y lo que cambiarías.';

  return (
    <Link
      href={href}
      className={cn(
        'flex w-full flex-col justify-center rounded-[var(--radius-md)] border border-[var(--color-border)]',
        'bg-[linear-gradient(135deg,var(--color-surface),var(--color-overlay))] px-5 py-4',
        'transition-colors hover:border-[var(--color-border-strong)]',
        className,
      )}
      style={{ minHeight }}
      data-house-ad="true"
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">
        Publicidad · TradingLab
      </span>
      <span className="mt-2 text-[13px] font-semibold">{headline}</span>
      <span className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">{body}</span>
    </Link>
  );
}
