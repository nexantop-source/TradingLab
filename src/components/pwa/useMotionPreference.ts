'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/** Keep the SSR and hydration tree identical, especially Motion's drag feature. */
export function useMotionPreference() {
  const preference = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  // CSS honors the preference before hydration; JS gestures follow after mount.
  return hydrated && Boolean(preference);
}
