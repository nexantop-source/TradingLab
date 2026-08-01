'use client';

import * as React from 'react';
import type { ServedAd } from '@tl/types';
import { AD_SLOT_BY_CODE, isForbiddenSurface } from '@tl/ads';
import { cn } from '@tl/ui';

/**
 * Espacio publicitario.
 *
 * Garantías implementadas en el propio componente:
 *  · Reserva el alto declarado antes de pedir el anuncio, de modo que nunca
 *    se produce desplazamiento del contenido (CLS).
 *  · Si no hay anuncio, colapsa el espacio en lugar de dejar un hueco vacío.
 *  · La etiqueta «Publicidad» es parte del marcado y no se puede desactivar.
 *  · Se niega a renderizar en superficies prohibidas, incluso si alguien pasa
 *    el código de un emplazamiento por error.
 *  · Registra la impresión solo cuando el bloque entra realmente en pantalla,
 *    y la marca como visible tras un segundo continuo.
 */
export function AdSlot({
  code,
  page,
  topic,
  className,
}: {
  code: string;
  page: string;
  topic?: string;
  className?: string;
}) {
  const descriptor = AD_SLOT_BY_CODE.get(code);
  const [ad, setAd] = React.useState<ServedAd | null>(null);
  const [state, setState] = React.useState<'loading' | 'filled' | 'empty'>('loading');
  const ref = React.useRef<HTMLDivElement>(null);
  const reported = React.useRef(false);

  const forbidden = !descriptor || isForbiddenSurface(descriptor.surface) || isForbiddenSurface(page);

  React.useEffect(() => {
    if (forbidden) return;
    let cancelled = false;

    const params = new URLSearchParams({ slot: code, page });
    if (topic) params.set('topic', topic);

    fetch(`/api/ads/serve?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.ok && json.data?.ad) {
          setAd(json.data.ad);
          setState('filled');
        } else {
          setState('empty');
        }
      })
      .catch(() => {
        if (!cancelled) setState('empty');
      });

    return () => {
      cancelled = true;
    };
  }, [code, page, topic, forbidden]);

  // Medición de impresión y viewability.
  React.useEffect(() => {
    if (!ad || !ref.current || reported.current) return;
    const element = ref.current;
    let viewableTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (!reported.current) {
              reported.current = true;
              void sendEvent('IMPRESSION', ad, code, page);
            }
            viewableTimer = setTimeout(() => {
              void sendEvent('VIEWABLE', ad, code, page);
            }, 1000);
          } else if (viewableTimer) {
            clearTimeout(viewableTimer);
            viewableTimer = null;
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      if (viewableTimer) clearTimeout(viewableTimer);
    };
  }, [ad, code, page]);

  if (forbidden) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[AdSlot] Se ha intentado renderizar publicidad en una superficie prohibida: ${code} / ${page}`);
    }
    return null;
  }

  // Sin relleno: se colapsa. Un hueco vacío reservado es peor que no reservarlo.
  if (state === 'empty') return null;

  return (
    <div
      ref={ref}
      className={cn('w-full', className)}
      style={{ minHeight: state === 'loading' ? descriptor.reservedHeight : undefined }}
      role="complementary"
      aria-label="Espacio publicitario"
    >
      {state === 'loading' && (
        <div
          className="skeleton h-full w-full rounded-[var(--radius-md)]"
          style={{ height: descriptor.reservedHeight }}
        />
      )}

      {ad && (
        <a
          href={ad.destinationUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => void sendEvent('CLICK', ad, code, page)}
          className={cn(
            'group block rounded-[var(--radius-md)] border border-[var(--color-border)]',
            'bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-border-strong)]',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-overlay)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
              Publicidad
            </span>
            <span className="text-[10px] text-[var(--color-subtle)]">{ad.advertiserName}</span>
          </div>
          <p className="mt-2.5 text-[13px] font-semibold leading-snug transition-colors group-hover:text-[var(--color-blue)]">
            {ad.headline}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">{ad.body}</p>
          <p className="mt-2.5 text-[11px] font-medium text-[var(--color-blue)]">{ad.ctaLabel} →</p>
          <p className="mt-2 border-t border-[var(--color-border)] pt-2 text-[9px] leading-relaxed text-[var(--color-subtle)]">
            {ad.disclosure}
          </p>
        </a>
      )}
    </div>
  );
}

function sendEvent(type: 'IMPRESSION' | 'CLICK' | 'VIEWABLE', ad: ServedAd, slotCode: string, page: string) {
  return fetch('/api/ads/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creativeId: ad.creativeId, campaignId: ad.campaignId, slotCode, type, page }),
    keepalive: true,
  }).catch(() => {
    /* La telemetría publicitaria nunca debe romper la experiencia. */
  });
}
