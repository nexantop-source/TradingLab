'use client';

import { useSyncExternalStore } from 'react';

const subscribe = (notify: () => void) => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const snapshot = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverSnapshot = () => false;

/** Keep the SSR and hydration tree identical, especially Motion's drag feature. */
export function useMotionPreference() {
  // CSS honors the preference before hydration; JS gestures follow after mount.
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
