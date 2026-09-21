'use client';

import * as React from 'react';
import type { DataProvenance } from '@tl/types';
import { cn } from './cn';

/**
 * Indicador de procedencia del dato.
 *
 * Criterio de aceptación #6: la fuente y la latencia del precio deben estar
 * siempre visibles. Este componente aparece junto a todo gráfico y a toda
 * cotización.
 */

const FRESHNESS_META: Record<
  DataProvenance['freshness'],
  { label: string; dot: string; text: string }
> = {
  REALTIME: { label: 'Tiempo real', dot: 'bg-[var(--color-positive)]', text: 'text-[var(--color-positive)]' },
  DELAYED: { label: 'Retrasado', dot: 'bg-[var(--color-gold)]', text: 'text-[var(--color-gold)]' },
  MARKET_CLOSED: { label: 'Mercado cerrado', dot: 'bg-[var(--color-subtle)]', text: 'text-[var(--color-muted)]' },
  STALE: { label: 'Dato desactualizado', dot: 'bg-[var(--color-negative)]', text: 'text-[var(--color-negative)]' },
  SIMULATED: { label: 'Serie educativa', dot: 'bg-[var(--color-violet)]', text: 'text-[var(--color-violet)]' },
};

export function DataProvenanceBadge({
  provenance,
  compact = false,
  className,
}: {
  provenance: DataProvenance;
  compact?: boolean;
  className?: string;
}) {
  const freshness = provenance.marketStatus !== 'OPEN' ? 'MARKET_CLOSED' : provenance.freshness;
  const meta = FRESHNESS_META[freshness];
  const [open, setOpen] = React.useState(false);
  const latency =
    provenance.latencyMs < 1000
      ? `${Math.round(provenance.latencyMs)} ms`
      : `${(provenance.latencyMs / 1000).toFixed(1)} s`;

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)]',
          'bg-[var(--color-overlay)] px-2.5 py-1 text-[10px] font-medium transition-colors',
          'hover:border-[var(--color-border-strong)]',
          meta.text,
        )}
      >
        <span
          className={cn('size-1.5 rounded-full', meta.dot, freshness === 'REALTIME' && 'animate-pulse-dot')}
          aria-hidden="true"
        />
        {meta.label}
        {!compact && <span className="num text-[var(--color-subtle)]">· {freshness === 'MARKET_CLOSED' ? 'Última referencia' : latency}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Detalle de la procedencia del dato"
          className="absolute left-0 top-full z-50 mt-2 w-72 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-3.5 shadow-[var(--shadow-lifted)]"
        >
          <dl className="space-y-2 text-[11px]">
            <Row label="Proveedor" value={provenance.providerLabel} />
            <Row label="Estado del mercado" value={MARKET_LABEL[provenance.marketStatus]} />
            <Row
              label="Marca temporal de la fuente"
              value={new Date(provenance.sourceTimestamp).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'}
            />
            <Row label="Latencia estimada" value={latency} />
            <Row label="Divisa de cotización" value={provenance.currency} />
            <Row label="Origen" value={provenance.synthetic ? 'Serie educativa sintética' : 'Mercado real'} />
          </dl>
          <p className="mt-3 border-t border-[var(--color-border)] pt-2.5 text-[10px] leading-relaxed text-[var(--color-subtle)]">
            {provenance.notice}
          </p>
        </div>
      )}
    </div>
  );
}

const MARKET_LABEL: Record<string, string> = {
  OPEN: 'Abierto',
  CLOSED: 'Cerrado',
  PRE_OPEN: 'Preapertura',
  HOLIDAY: 'Mercado cerrado · festivo',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="num text-right text-[var(--color-text)]">{value}</dd>
    </div>
  );
}
