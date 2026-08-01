'use client';

import * as React from 'react';
import { DISCLAIMERS } from '@tl/types/compliance';
import { cn } from './cn';
import { Badge } from './primitives';

/**
 * Componentes de cumplimiento.
 *
 * Se usan en lugar de escribir los avisos a mano, para que el texto legal
 * tenga un único origen (`@tl/types/compliance`) y una revisión de
 * cumplimiento pueda cambiarlo en un sitio.
 */

/** Píldora «DEMO». Acompaña siempre al saldo virtual. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="gold" className={cn('font-semibold tracking-[0.08em]', className)}>
      DEMO
    </Badge>
  );
}

/** Saldo virtual. Nunca se muestra un saldo sin este componente. */
export function VirtualBalance({
  cents,
  size = 'md',
  showLabel = true,
  className,
}: {
  cents: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  className?: string;
}) {
  const sizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };
  const value = (cents / 100).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-baseline gap-2">
        <span className={cn('num font-semibold tracking-tight', sizes[size])}>
          <span className="text-[var(--color-muted)]">USD </span>
          {value}
        </span>
        <DemoBadge />
      </div>
      {showLabel && (
        <p className="text-[11px] leading-snug text-[var(--color-muted)]">{DISCLAIMERS.balance}</p>
      )}
    </div>
  );
}

/** Aviso obligatorio previo a confirmar una simulación. */
export function SimulationDisclaimer({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        'rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-gold)_30%,transparent)]',
        'bg-[var(--color-gold-soft)] p-3',
        className,
      )}
    >
      <p className="text-[12px] leading-relaxed text-[var(--color-muted)]">
        <span className="font-semibold text-[var(--color-gold)]">Simulación educativa. </span>
        {DISCLAIMERS.beforeSimulation}
      </p>
    </div>
  );
}

/** Aviso al pie de todo análisis generado por IA. */
export function AIDisclaimer({ engine, className }: { engine?: string; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-overlay)] p-3',
        className,
      )}
    >
      <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">{DISCLAIMERS.ai}</p>
      {engine && (
        <p className="mt-1.5 text-[10px] text-[var(--color-subtle)]">
          Generado por: <span className="num">{engine}</span>
        </p>
      )}
    </div>
  );
}

/** Píldora de simulación para cabeceras y héroes. */
export function SimulationPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)]',
        'bg-[var(--color-overlay)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-muted)]',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-[var(--color-gold)]" aria-hidden="true" />
      {DISCLAIMERS.short}
    </span>
  );
}

/** Advertencia de riesgo, para el pie de página y el centro legal. */
export function RiskWarning({ className }: { className?: string }) {
  return (
    <p className={cn('text-[11px] leading-relaxed text-[var(--color-subtle)]', className)}>
      <span className="font-semibold text-[var(--color-muted)]">Advertencia de riesgo. </span>
      {DISCLAIMERS.risk}
    </p>
  );
}

/** Descripción de la naturaleza del servicio. */
export function ServiceNature({ className }: { className?: string }) {
  return (
    <p className={cn('text-[11px] leading-relaxed text-[var(--color-subtle)]', className)}>
      {DISCLAIMERS.nature}
    </p>
  );
}
