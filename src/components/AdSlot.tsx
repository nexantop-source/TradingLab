'use client';

import * as React from 'react';
import type { PlanId, ServedAd } from '@tl/types';
import { AD_SLOT_BY_CODE, isForbiddenSurface } from '@tl/ads';
import { cn } from '@tl/ui';
import { GoogleAdSlot } from '@/components/ads/GoogleAdSlot';
import { HouseAd } from '@/components/ads/HouseAd';

type SecureServedAd = ServedAd & { eventToken: string };

export interface AdSlotProps {
  code: string;
  page: string;
  topic?: string;
  className?: string;
  /**
   * Obligatorio para Google. La ausencia falla cerrada en ese proveedor para
   * impedir que un usuario Premium provoque siquiera una petición externa.
   */
  plan?: PlanId;
}
/**
 * Punto único de publicidad. El proveedor se decide al compilar con
 * NEXT_PUBLIC_ADS_PROVIDER: `internal`, `google` u `off`.
 */
export function AdSlot(props: AdSlotProps) {
  const provider = (process.env.NEXT_PUBLIC_ADS_PROVIDER ?? 'internal').trim().toLowerCase();
  if (provider === 'off') return null;
  if (provider === 'google') {
    return <GoogleAdSlot code={props.code} page={props.page} plan={props.plan} className={props.className} />;
  }
  return <InternalAdSlot {...props} />;
}

function InternalAdSlot({ code, page, topic, className, plan }: AdSlotProps) {
  const descriptor = AD_SLOT_BY_CODE.get(code);
  const [ad, setAd] = React.useState<SecureServedAd | null>(null);
  const [state, setState] = React.useState<'idle' | 'loading' | 'filled' | 'empty'>('idle');
  const ref = React.useRef<HTMLDivElement>(null);
  const requested = React.useRef(false);
  const impressionPromise = React.useRef<Promise<string | null> | null>(null);
  const viewableReported = React.useRef(false);

  const forbidden =
    plan === 'PREMIUM' || !descriptor || isForbiddenSurface(descriptor.surface) || isForbiddenSurface(page);

  // Pide inventario solo cuando el espacio está a 700 px del viewport.
  React.useEffect(() => {
    if (forbidden || !ref.current) return;
    const element = ref.current;
    const controller = new AbortController();
    requested.current = false;
    setAd(null);
    setState('idle');
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || requested.current) return;
        requested.current = true;
        setState('loading');

        const params = new URLSearchParams({ slot: code, page });
        if (topic) params.set('topic', topic);

        fetch(`/api/ads/serve?${params}`, { credentials: 'same-origin', signal: controller.signal })
          .then((response) => response.json())
          .then((json) => {
            const served = json?.ok ? (json.data?.ad as SecureServedAd | null | undefined) : null;
            if (served?.eventToken) {
              setAd(served);
              setState('filled');
            } else {
              setState('empty');
            }
          })
          .catch(() => {
            if (!controller.signal.aborted) setState('empty');
          });
        observer.disconnect();
      },
      { rootMargin: '700px 0px', threshold: 0 },
    );
    observer.observe(element);
    return () => {
      controller.abort();
      observer.disconnect();
    };
  }, [code, page, topic, forbidden]);

  // Registra una sola impresión y asocia la viewability a esa fila exacta.
  React.useEffect(() => {
    if (!ad || !ref.current) return;
    impressionPromise.current = null;
    viewableReported.current = false;
    const element = ref.current;
    let viewableTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            impressionPromise.current ??= sendEvent('IMPRESSION', ad, code, page).then(
              (result) => result?.impressionId ?? null,
            );
            if (!viewableReported.current && !viewableTimer) {
              viewableTimer = setTimeout(() => {
                viewableReported.current = true;
                void impressionPromise.current?.then((impressionId) => {
                  if (impressionId) void sendEvent('VIEWABLE', ad, code, page, impressionId);
                });
              }, 1000);
            }
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

  if (forbidden || !descriptor) {
    if (process.env.NODE_ENV === 'development' && plan !== 'PREMIUM') {
      console.warn(`[AdSlot] Publicidad bloqueada en superficie prohibida: ${code} / ${page}`);
    }
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn('w-full', className)}
      style={{ minHeight: descriptor.reservedHeight }}
      role="complementary"
      aria-label="Espacio publicitario"
      data-ad-slot={code}
    >
      {(state === 'idle' || state === 'loading') && (
        <div
          className="relative w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]"
          style={{ height: descriptor.reservedHeight }}
        >
          <span className="absolute left-3 top-2 z-10 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
            Publicidad
          </span>
          <div className="skeleton size-full" aria-hidden="true" />
        </div>
      )}

      {state === 'empty' && <HouseAd code={code} minHeight={descriptor.reservedHeight} />}

      {ad && state === 'filled' && (
        <a
          href={ad.destinationUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => void sendEvent('CLICK', ad, code, page)}
          className={cn(
            'group flex flex-col justify-center rounded-[var(--radius-md)] border border-[var(--color-border)]',
            'bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-border-strong)]',
          )}
          style={{ minHeight: descriptor.reservedHeight }}
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

async function sendEvent(
  type: 'IMPRESSION' | 'CLICK' | 'VIEWABLE',
  ad: SecureServedAd,
  slotCode: string,
  page: string,
  impressionId?: string,
): Promise<{ recorded: boolean; impressionId?: string } | null> {
  try {
    const response = await fetch('/api/ads/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creativeId: ad.creativeId,
        campaignId: ad.campaignId,
        slotCode,
        type,
        page,
        eventToken: ad.eventToken,
        impressionId,
      }),
      credentials: 'same-origin',
      keepalive: true,
    });
    const json = await response.json();
    return json?.ok ? json.data : null;
  } catch {
    // La telemetría publicitaria nunca debe romper la experiencia.
    return null;
  }
}
