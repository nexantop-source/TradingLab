import { describe, expect, it } from 'vitest';
import {
  accruedCpmCents,
  isForbiddenSurface,
  stableAdSeed,
  standardAdOpportunity,
} from '@tl/ads';
import {
  AD_EVENT_TOKEN_TTL_MS,
  adViewerBinding,
  claimAdEventOnce,
  issueAdEventToken,
  releaseAdEventClaim,
  verifyAdEventToken,
} from '../src/components/ads/ad-event-security';
import { canLoadGoogleAd, googleAdSize } from '../src/components/ads/google-config';

const SECRET = 'ads-test-secret-with-at-least-32-characters';
const NOW = 1_800_000_000_000;

describe('recibos de eventos publicitarios', () => {
  it('firma y valida solo para el mismo visor', async () => {
    const viewer = await adViewerBinding(SECRET, 'user:u1:session:s1');
    const token = await issueAdEventToken(
      SECRET,
      {
        creativeId: 'creative-1',
        campaignId: 'campaign-1',
        slotCode: 'dashboard-side',
        page: 'dashboard',
        viewer,
      },
      NOW,
    );

    const claims = await verifyAdEventToken(SECRET, token, viewer, NOW + 1_000);
    expect(claims?.creativeId).toBe('creative-1');
    expect(await verifyAdEventToken(SECRET, token, 'otro-visor-seguro', NOW + 1_000)).toBeNull();
  });

  it('rechaza manipulación y expiración', async () => {
    const viewer = await adViewerBinding(SECRET, 'anon:127.0.0.1:ua:test');
    const token = await issueAdEventToken(
      SECRET,
      {
        creativeId: 'creative-1',
        campaignId: 'campaign-1',
        slotCode: 'public-banner',
        page: 'public',
        viewer,
      },
      NOW,
    );
    const tampered = `${token[0] === 'A' ? 'B' : 'A'}${token.slice(1)}`;

    expect(await verifyAdEventToken(SECRET, tampered, viewer, NOW)).toBeNull();
    expect(await verifyAdEventToken(SECRET, token, viewer, NOW + AD_EVENT_TOKEN_TTL_MS)).toBeNull();
  });

  it('acepta una sola vez cada jti/tipo y permite reintento tras liberar', () => {
    const key = 'nonce-unico:IMPRESSION';
    expect(claimAdEventOnce(key, NOW + 60_000, NOW)).toBe(true);
    expect(claimAdEventOnce(key, NOW + 60_000, NOW)).toBe(false);
    releaseAdEventClaim(key);
    expect(claimAdEventOnce(key, NOW + 60_000, NOW)).toBe(true);
    releaseAdEventClaim(key);
  });
});

describe('puerta de Google AdSense', () => {
  const allowed = {
    enabled: true,
    consent: 'granted' as const,
    plan: 'FREE' as const,
    code: 'public-banner',
    page: 'public',
    publisherId: 'ca-pub-1234567890123456',
    slotId: '1234567890',
  };

  it('requiere consentimiento explícito y configuración válida', () => {
    expect(canLoadGoogleAd(allowed)).toBe(true);
    expect(canLoadGoogleAd({ ...allowed, consent: null })).toBe(false);
    expect(canLoadGoogleAd({ ...allowed, consent: 'denied' })).toBe(false);
    expect(canLoadGoogleAd({ ...allowed, publisherId: 'ca-pub-placeholder' })).toBe(false);
    expect(canLoadGoogleAd({ ...allowed, slotId: '' })).toBe(false);
  });

  it('bloquea Premium, plan ausente y superficies prohibidas anidadas', () => {
    expect(canLoadGoogleAd({ ...allowed, plan: 'PREMIUM' })).toBe(false);
    expect(canLoadGoogleAd({ ...allowed, plan: undefined })).toBe(false);
    expect(canLoadGoogleAd({ ...allowed, page: '/checkout/resultado' })).toBe(false);
    expect(isForbiddenSurface('/terminal/grafico?mode=demo')).toBe(true);
    expect(isForbiddenSurface('/entrenador/sesion')).toBe(true);
  });

  it('reserva dimensiones estándar por breakpoint', () => {
    expect(googleAdSize('public-banner', 390)).toEqual({ width: 320, height: 100 });
    expect(googleAdSize('public-banner', 1440)).toEqual({ width: 728, height: 90 });
    expect(googleAdSize('dashboard-side', 390)).toEqual({ width: 300, height: 250 });
    expect(googleAdSize('unknown', 1440)).toBeNull();
  });
});

describe('densidad determinística de Standard', () => {
  it('distribuye una de cada tres oportunidades y cambia con el bucket', () => {
    expect(Array.from({ length: 6 }, (_, seed) => standardAdOpportunity(seed)).filter(Boolean)).toHaveLength(2);
    expect(stableAdSeed('viewer:slot:bucket-1')).not.toBe(stableAdSeed('viewer:slot:bucket-2'));
  });
});

describe('contabilidad CPM', () => {
  it('redondea el acumulado y no cada impresión', () => {
    expect(accruedCpmCents(1, 500, 10_000)).toBe(0);
    expect(accruedCpmCents(2, 500, 10_000)).toBe(1);
    expect(accruedCpmCents(1_000, 500, 10_000)).toBe(500);
    expect(accruedCpmCents(100_000, 500, 2_000)).toBe(2_000);
  });
});
