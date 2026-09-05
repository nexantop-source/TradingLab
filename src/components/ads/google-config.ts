import type { PlanId } from '@tl/types';
import { entitlements } from '@tl/types/plans';
import { AD_SLOT_BY_CODE, isForbiddenSurface } from '@tl/ads';

export interface GoogleAdBreakpointSize {
  width: number;
  height: number;
}

export interface GoogleAdResponsiveSize {
  mobile: GoogleAdBreakpointSize;
  desktop: GoogleAdBreakpointSize;
  format: 'horizontal' | 'rectangle' | 'vertical';
}

/**
 * Geometría reservada antes de cargar Google. Estas dimensiones corresponden
 * a tamaños publicitarios estándar y evitan que un fill tardío mueva la UI.
 */
export const GOOGLE_AD_SIZES: Readonly<Record<string, GoogleAdResponsiveSize>> = {
  'dashboard-banner': {
    mobile: { width: 320, height: 100 },
    desktop: { width: 728, height: 90 },
    format: 'horizontal',
  },
  'dashboard-side': {
    mobile: { width: 300, height: 250 },
    desktop: { width: 300, height: 250 },
    format: 'rectangle',
  },
  'academy-footer': {
    mobile: { width: 320, height: 100 },
    desktop: { width: 728, height: 90 },
    format: 'horizontal',
  },
  'lesson-sponsor': {
    mobile: { width: 320, height: 100 },
    desktop: { width: 728, height: 90 },
    format: 'horizontal',
  },
  'calendar-sponsor': {
    mobile: { width: 320, height: 100 },
    desktop: { width: 728, height: 90 },
    format: 'horizontal',
  },
  'news-native': {
    mobile: { width: 300, height: 250 },
    desktop: { width: 336, height: 280 },
    format: 'rectangle',
  },
  'public-banner': {
    mobile: { width: 320, height: 100 },
    desktop: { width: 728, height: 90 },
    format: 'horizontal',
  },
  'challenge-sponsor': {
    mobile: { width: 320, height: 100 },
    desktop: { width: 728, height: 90 },
    format: 'horizontal',
  },
  'weekly-report-sponsor': {
    mobile: { width: 320, height: 100 },
    desktop: { width: 728, height: 90 },
    format: 'horizontal',
  },
};

export const GOOGLE_SLOT_IDS: Readonly<Record<string, string | undefined>> = {
  'dashboard-banner': process.env.NEXT_PUBLIC_GOOGLE_AD_SLOT_DASHBOARD_BANNER,
  'dashboard-side': process.env.NEXT_PUBLIC_GOOGLE_AD_SLOT_DASHBOARD_SIDE,
  'academy-footer': process.env.NEXT_PUBLIC_GOOGLE_AD_SLOT_ACADEMY_FOOTER,
  'lesson-sponsor': process.env.NEXT_PUBLIC_GOOGLE_AD_SLOT_LESSON_SPONSOR,
  'calendar-sponsor': process.env.NEXT_PUBLIC_GOOGLE_AD_SLOT_CALENDAR_SPONSOR,
  'news-native': process.env.NEXT_PUBLIC_GOOGLE_AD_SLOT_NEWS_NATIVE,
  'public-banner': process.env.NEXT_PUBLIC_GOOGLE_AD_SLOT_PUBLIC_BANNER,
  'challenge-sponsor': process.env.NEXT_PUBLIC_GOOGLE_AD_SLOT_CHALLENGE_SPONSOR,
  'weekly-report-sponsor': process.env.NEXT_PUBLIC_GOOGLE_AD_SLOT_WEEKLY_REPORT_SPONSOR,
};

export function googleAdSize(code: string, viewportWidth: number): GoogleAdBreakpointSize | null {
  const size = GOOGLE_AD_SIZES[code];
  if (!size) return null;
  return viewportWidth >= 768 ? size.desktop : size.mobile;
}

export function validGooglePublisherId(value: string | undefined): value is string {
  return Boolean(value && /^ca-pub-\d{16}$/.test(value));
}

export function validGoogleSlotId(value: string | undefined): value is string {
  return Boolean(value && /^\d{6,20}$/.test(value));
}

export interface GoogleAdEligibilityInput {
  enabled: boolean;
  consent: 'granted' | 'denied' | null;
  plan: PlanId | undefined;
  code: string;
  page: string;
  publisherId: string | undefined;
  slotId: string | undefined;
}

/** Política pura y fail-closed, compartida por la UI y las pruebas. */
export function canLoadGoogleAd(input: GoogleAdEligibilityInput): boolean {
  if (!input.enabled || input.consent !== 'granted') return false;
  if (!input.plan || entitlements(input.plan).adDensity === 'none') return false;
  const descriptor = AD_SLOT_BY_CODE.get(input.code);
  if (!descriptor || !GOOGLE_AD_SIZES[input.code]) return false;
  if (isForbiddenSurface(descriptor.surface) || isForbiddenSurface(input.page)) return false;
  return validGooglePublisherId(input.publisherId) && validGoogleSlotId(input.slotId);
}
