'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@tl/ui';

export type AdConsentPreference = 'granted' | 'denied';

export const AD_CONSENT_STORAGE_KEY = 'tl-ad-consent-v1';
export const AD_CONSENT_EVENT = 'tl:ad-consent';

function googleAdsConfigured() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ENABLED === 'true' &&
    process.env.NEXT_PUBLIC_ADS_PROVIDER === 'google' &&
    Boolean(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.trim())
  );
}

export function readAdConsent(): AdConsentPreference | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(AD_CONSENT_STORAGE_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function setAdConsent(value: AdConsentPreference) {
  window.localStorage.setItem(AD_CONSENT_STORAGE_KEY, value);
  window.dispatchEvent(new CustomEvent<AdConsentPreference>(AD_CONSENT_EVENT, { detail: value }));
}

/**
 * Control local que impide cargar la etiqueta publicitaria de Google antes de
 * una elección explícita. En producción debe convivir con la CMP certificada
 * que se configure en Google Privacy & Messaging para tráfico regulado.
 */
export function AdPrivacyBanner() {
  const googleConfigured = googleAdsConfigured();
  const [preference, setPreference] = React.useState<AdConsentPreference | null | undefined>(undefined);

  React.useEffect(() => {
    setPreference(readAdConsent());
  }, []);

  if (!googleConfigured || preference !== null) return null;

  const choose = (value: AdConsentPreference) => {
    setAdConsent(value);
    setPreference(value);
  };

  return (
    <aside
      role="dialog"
      aria-label="Preferencias de publicidad"
      aria-describedby="tl-ad-privacy-description"
      className="fixed inset-x-3 bottom-3 z-[120] mx-auto max-w-3xl rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[color-mix(in_srgb,var(--color-elevated)_96%,transparent)] p-4 shadow-[var(--shadow-lifted)] backdrop-blur-2xl sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Tú decides si activamos publicidad programática</p>
          <p id="tl-ad-privacy-description" className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">
            Las funciones esenciales siempre operan. Google solo se carga si aceptas publicidad y medición; puedes
            cambiar tu elección desde Privacidad. Consulta la{' '}
            <Link href="/legal/cookies" className="font-medium text-[var(--color-blue)] underline-offset-2 hover:underline">
              política de cookies
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => choose('denied')}>
            Solo esenciales
          </Button>
          <Button size="sm" onClick={() => choose('granted')}>
            Aceptar publicidad
          </Button>
        </div>
      </div>
    </aside>
  );
}

export function AdPrivacyControl() {
  const googleConfigured = googleAdsConfigured();
  const [preference, setPreference] = React.useState<AdConsentPreference | null>(null);

  React.useEffect(() => {
    setPreference(readAdConsent());
  }, []);

  if (!googleConfigured) {
    return (
      <p className="text-[12px] leading-relaxed text-[var(--color-muted)]">
        La publicidad de Google no está configurada en este entorno. No se carga ninguna etiqueta programática.
      </p>
    );
  }

  const choose = (value: AdConsentPreference) => {
    setAdConsent(value);
    setPreference(value);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant={preference === 'denied' ? 'primary' : 'secondary'} onClick={() => choose('denied')}>
        Solo esenciales
      </Button>
      <Button size="sm" variant={preference === 'granted' ? 'primary' : 'secondary'} onClick={() => choose('granted')}>
        Permitir publicidad
      </Button>
      <span className="text-[11px] text-[var(--color-subtle)]">
        Estado: {preference === 'granted' ? 'permitida' : preference === 'denied' ? 'rechazada' : 'sin elegir'}
      </span>
    </div>
  );
}
