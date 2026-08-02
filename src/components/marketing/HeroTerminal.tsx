'use client';

import * as React from 'react';
import type { Candle, DataProvenance, Timeframe } from '@tl/types';
import { PriceChart, DataProvenanceBadge, Badge, Delta, cn } from '@tl/ui';
import { VirtualBalance } from '@tl/ui/compliance';
import { Sparkles } from 'lucide-react';

export interface HeroTicker {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  precision: number;
  assetClass: string;
}

/**
 * Maqueta interactiva del terminal para el hero.
 *
 * Es funcional dentro de sus límites: el gráfico es el mismo componente que
 * usa la terminal real, con datos reales del motor educativo. No se muestran
 * cifras de usuarios ni testimonios inventados.
 */
export function HeroTerminal({
  candles,
  provenance,
  tickers,
  symbol,
  assetName,
  precision,
  timeframe,
  aiPreview,
}: {
  candles: Candle[];
  provenance: DataProvenance;
  tickers: HeroTicker[];
  symbol: string;
  assetName: string;
  precision: number;
  timeframe: Timeframe;
  aiPreview: { trend: string; bullish: string; bearish: string; question: string };
}) {
  const [active, setActive] = React.useState(symbol);
  const last = candles[candles.length - 1];
  const first = candles[0];
  const change = first && last ? ((last.c - first.c) / first.c) * 100 : 0;

  return (
    <div className="relative">
      {/* Resplandor de fondo, muy contenido */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-6 -inset-y-8 -z-10 rounded-[var(--radius-xl)] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_srgb,var(--color-blue)_18%,transparent),transparent_70%)] blur-2xl"
      />

      <div className="overflow-hidden rounded-[2rem] border border-[var(--color-border-strong)] bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] shadow-[var(--shadow-lifted)] backdrop-blur-2xl">
        {/* Barra superior */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Badge tone="gold">CUENTA DEMO</Badge>
            <span className="num text-[13px] font-semibold">
              <span className="text-[var(--color-muted)]">USD </span>10.000,00
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DataProvenanceBadge provenance={provenance} compact />
          </div>
        </div>

        <div className="grid lg:grid-cols-[190px_1fr]">
          {/* Watchlist */}
          <div className="hidden border-r border-[var(--color-border)] lg:block">
            <p className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
              Lista de seguimiento
            </p>
            <ul className="space-y-px pb-2">
              {tickers.map((t) => (
                <li key={t.symbol}>
                  <button
                    type="button"
                    onClick={() => setActive(t.symbol)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors',
                      active === t.symbol
                        ? 'bg-[var(--color-blue-soft)]'
                        : 'hover:bg-[var(--color-overlay)]',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="num block text-[11px] font-medium">{t.symbol}</span>
                      <span className="block truncate text-[9px] text-[var(--color-subtle)]">
                        {t.assetClass}
                      </span>
                    </span>
                    <Delta value={t.changePercent} size="sm" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Gráfico */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-3">
              <span className="num text-sm font-semibold">{symbol}</span>
              <span className="text-[11px] text-[var(--color-muted)]">{assetName}</span>
              <span className="num ml-auto text-lg font-semibold">
                {last?.c.toFixed(precision)}
              </span>
              <Delta value={change} />
            </div>
            <PriceChart
              candles={candles}
              symbol={symbol}
              assetName={assetName}
              timeframe={timeframe}
              precision={precision}
              chartType="candles"
              indicators={['SMA20']}
              height={360}
              showVolume={false}
            />
          </div>
        </div>

        {/* Panel de análisis educativo */}
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-[var(--color-violet)]" aria-hidden="true" />
            <span className="text-[11px] font-semibold text-[var(--color-violet)]">
              Análisis educativo del entrenador
            </span>
          </div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-text)]">{aiPreview.trend}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <EvidenceRow tone="positive" label="A favor del alza" text={aiPreview.bullish} />
            <EvidenceRow tone="negative" label="A favor de la baja" text={aiPreview.bearish} />
          </div>
          <p className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-[12px] leading-relaxed text-[var(--color-muted)]">
            <span className="font-medium text-[var(--color-text)]">Pregunta para ti: </span>
            {aiPreview.question}
          </p>
          <p className="mt-2.5 text-[10px] leading-relaxed text-[var(--color-subtle)]">
            El entrenador nunca afirma que una operación tendrá éxito. Describe escenarios, señala riesgos e
            indica qué invalidaría cada hipótesis.
          </p>
        </div>
      </div>

      {/* Tarjeta flotante de saldo, solo en pantallas grandes */}
      <div className="absolute -bottom-6 -left-4 hidden rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-elevated)] px-4 py-3 shadow-[var(--shadow-lifted)] xl:block">
        <VirtualBalance cents={1_000_000} size="sm" showLabel={false} />
        <p className="mt-1 text-[10px] text-[var(--color-subtle)]">Al crear tu cuenta</p>
      </div>
    </div>
  );
}

function EvidenceRow({
  tone,
  label,
  text,
}: {
  tone: 'positive' | 'negative';
  label: string;
  text: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-sm)] border p-2.5',
        tone === 'positive'
          ? 'border-[color-mix(in_srgb,var(--color-positive)_24%,transparent)] bg-[var(--color-positive-soft)]'
          : 'border-[color-mix(in_srgb,var(--color-negative)_24%,transparent)] bg-[var(--color-negative-soft)]',
      )}
    >
      <p
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wider',
          tone === 'positive' ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
        )}
      >
        {label}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">{text}</p>
    </div>
  );
}
