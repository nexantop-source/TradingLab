'use client';

import * as React from 'react';
import { cn } from '@tl/ui';

/**
 * Curva simple en SVG.
 *
 * No usa ninguna biblioteca de gráficos: es una polilínea con relleno. Incluye
 * alternativa textual accesible, igual que el gráfico de precios.
 */
export function EquityCurve({
  points,
  height = 160,
  tone = 'blue',
  suffix = '',
  className,
}: {
  points: Array<{ t: number; value: number }>;
  height?: number;
  tone?: 'blue' | 'positive';
  suffix?: string;
  className?: string;
}) {
  if (points.length < 2) return null;

  const width = 600;
  const pad = 4;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' ');
  const area = `${line} L ${x(points.length - 1).toFixed(2)} ${y(min).toFixed(2)} L ${x(0).toFixed(2)} ${y(min).toFixed(2)} Z`;
  const zeroY = y(0);

  const color = tone === 'positive' ? 'var(--color-positive)' : 'var(--color-blue)';
  const last = points[points.length - 1].value;
  const first = points[0].value;

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Evolución de ${points.length} puntos. Valor inicial ${first.toFixed(0)}${suffix}, valor final ${last.toFixed(0)}${suffix}.`}
      >
        <defs>
          <linearGradient id={`curve-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {min < 0 && max > 0 && (
          <line
            x1={pad}
            y1={zeroY}
            x2={width - pad}
            y2={zeroY}
            stroke="var(--color-border-strong)"
            strokeDasharray="3 3"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}

        <path d={area} fill={`url(#curve-${tone})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-2 flex justify-between text-[10px] text-[var(--color-subtle)]">
        <span className="num">
          {first.toFixed(0)}
          {suffix}
        </span>
        <span className="num">
          {last.toFixed(0)}
          {suffix}
        </span>
      </div>
    </div>
  );
}
