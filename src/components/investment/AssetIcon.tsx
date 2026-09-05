'use client';

import { useState } from 'react';
import type { AssetClass } from '@tl/types';
import identities from './instrument-identities.json';

interface Identity {
  label: string;
  src: string;
  secondary?: string;
  kind?: string;
}

/** Brand identity, not an asset-class placeholder. Tickers remain visible beside it. */
export function AssetIcon({ symbol, size = 'md', decorative = true, className = '' }: {
  symbol: string;
  assetClass?: AssetClass;
  size?: 'sm' | 'md' | 'lg';
  decorative?: boolean;
  className?: string;
}) {
  const identity = (identities as Record<string, Identity>)[symbol.toUpperCase()];
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = !identity || failedSource === identity.src || failedSource === identity.secondary;
  return (
    <span
      className={`instrument-icon instrument-icon--${size} ${identity?.secondary ? 'instrument-icon--pair' : ''} ${failed ? 'instrument-icon--fallback' : ''} ${className}`}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : identity?.label ?? symbol}
      title={identity?.label ?? symbol}
    >
      {failed ? <span className="instrument-icon-fallback">{symbol}</span> : <>
        {/* Local SVGs: no tracking, remote service, or network-dependent fallback. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={identity.src} alt="" width={40} height={40} decoding="async" onError={() => setFailedSource(identity.src)} />
        {identity.secondary && <img className="instrument-icon-counter" src={identity.secondary} alt="" width={24} height={24} decoding="async" onError={() => setFailedSource(identity.secondary!)} />}
      </>}
    </span>
  );
}
