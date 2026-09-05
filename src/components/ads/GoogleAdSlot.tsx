'use client';

import * as React from 'react';
import type { PlanId } from '@tl/types';
import { entitlements } from '@tl/types/plans';
import { cn } from '@tl/ui';
import { AD_CONSENT_EVENT, readAdConsent, type AdConsentPreference } from './AdPrivacy';
import { HouseAd } from './HouseAd';
import {
  GOOGLE_AD_SIZES,
  GOOGLE_SLOT_IDS,
  canLoadGoogleAd,
  googleAdSize,
  validGooglePublisherId,
  validGoogleSlotId,
} from './google-config';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, never>>;
  }
}

const SCRIPT_ID = 'tl-google-adsense';
let googleScriptPromise: Promise<void> | null = null;

function ensureGoogleScript(publisherId: string): Promise<void> {
  if (!validGooglePublisherId(publisherId)) return Promise.reject(new Error('Publisher ID inválido.'));
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === 'true') {
      resolve();
      return;
    }

    const script = existing ?? document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      publisherId,
    )}`;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      'error',
      () => {
        googleScriptPromise = null;
        reject(new Error('No se pudo cargar Google AdSense.'));
      },
      { once: true },
    );
    if (!existing) document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export function GoogleAdSlot({
  code,
  page,
  plan,
  className,
}: {
  code: string;
  page: string;
  plan: PlanId | undefined;
  className?: string;
}) {
  const enabled = process.env.NEXT_PUBLIC_GOOGLE_ADS_ENABLED === 'true';
  const publisherId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;
  const slotId = GOOGLE_SLOT_IDS[code];
  const sizeDescriptor = GOOGLE_AD_SIZES[code];
  const [consent, setConsent] = React.useState<AdConsentPreference | null>(null);
  const [nearViewport, setNearViewport] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'filled' | 'house'>('idle');
  const [viewportWidth, setViewportWidth] = React.useState(1024);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const insRef = React.useRef<HTMLModElement>(null);
  const requested = React.useRef(false);

  const configurationEligible =
    enabled &&
    Boolean(plan) &&
    Boolean(plan && entitlements(plan).adDensity !== 'none') &&
    Boolean(sizeDescriptor) &&
    validGooglePublisherId(publisherId) &&
    validGoogleSlotId(slotId);

  React.useEffect(() => {
    if (!configurationEligible) return;
    const syncConsent = (event?: Event) => {
      const custom = event as CustomEvent<AdConsentPreference> | undefined;
      setConsent(custom?.detail === 'granted' || custom?.detail === 'denied' ? custom.detail : readAdConsent());
    };
    syncConsent();
    window.addEventListener(AD_CONSENT_EVENT, syncConsent);
    return () => window.removeEventListener(AD_CONSENT_EVENT, syncConsent);
  }, [configurationEligible]);

  React.useEffect(() => {
    if (!configurationEligible || consent !== 'granted' || !rootRef.current) return;
    setNearViewport(false);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '700px 0px', threshold: 0 },
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [code, page, configurationEligible, consent]);

  React.useEffect(() => {
    if (!configurationEligible || consent !== 'granted') return;
    const updateWidth = () => setViewportWidth(window.innerWidth);
    updateWidth();
    window.addEventListener('resize', updateWidth, { passive: true });
    return () => window.removeEventListener('resize', updateWidth);
  }, [configurationEligible, consent]);

  const eligible = canLoadGoogleAd({ enabled, consent, plan, code, page, publisherId, slotId });

  React.useEffect(() => {
    requested.current = false;
    setStatus('idle');
  }, [code, page, slotId, consent]);

  React.useEffect(() => {
    if (!eligible || !nearViewport || requested.current || !publisherId || !slotId) return;
    requested.current = true;
    setStatus('loading');

    let cancelled = false;
    let statusObserver: MutationObserver | null = null;
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled && insRef.current?.dataset.adStatus !== 'filled') setStatus('house');
    }, 12_000);

    void ensureGoogleScript(publisherId)
      .then(() => {
        if (cancelled || !insRef.current) return;
        statusObserver = new MutationObserver(() => {
          const adStatus = insRef.current?.dataset.adStatus;
          if (adStatus === 'filled') setStatus('filled');
          if (adStatus === 'unfilled') setStatus('house');
        });
        statusObserver.observe(insRef.current, { attributes: true, attributeFilter: ['data-ad-status'] });
        window.adsbygoogle ??= [];
        window.adsbygoogle.push({});
      })
      .catch(() => {
        if (!cancelled) setStatus('house');
      });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      statusObserver?.disconnect();
    };
  }, [eligible, nearViewport, publisherId, slotId]);

  // Fail-closed: sin plan explícito, consentimiento o configuración válida no
  // existe ni script, ni request a Google, ni hueco en el layout.
  if (!eligible || !sizeDescriptor || !slotId || !publisherId) return null;

  const size = googleAdSize(code, viewportWidth) ?? sizeDescriptor.desktop;
  const reservedHeight = size.height + 18;

  return (
    <div
      ref={rootRef}
      role="complementary"
      aria-label="Espacio publicitario"
      className={cn('mx-auto w-full', className)}
      style={{ minHeight: reservedHeight, maxWidth: size.width }}
      data-google-ad-slot={code}
    >
      {status === 'house' ? (
        <HouseAd code={code} minHeight={reservedHeight} />
      ) : (
        <div className="w-full" style={{ minHeight: reservedHeight }}>
          <span className="flex h-[18px] items-center justify-center text-[9px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
            Publicidad
          </span>
          <ins
            ref={insRef}
            className="adsbygoogle block w-full"
            style={{ display: 'block', minHeight: size.height }}
            data-ad-client={publisherId}
            data-ad-slot={slotId}
            data-ad-format={sizeDescriptor.format}
            data-full-width-responsive="true"
            data-adtest={process.env.NEXT_PUBLIC_GOOGLE_ADS_TEST_MODE === 'true' ? 'on' : undefined}
          />
        </div>
      )}
    </div>
  );
}
