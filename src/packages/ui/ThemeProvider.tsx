'use client';

import * as React from 'react';
import type { ThemeId } from '@tl/types';

/**
 * Gestión de tema y preferencias de accesibilidad.
 *
 * El tema se aplica en `data-theme` sobre `<html>`, y la preferencia de
 * movimiento reducido en `data-reduce-motion`. Ambos se leen desde CSS.
 * Se persisten en `localStorage` y, para usuarios autenticados, también en su
 * perfil (`/api/me/preferences`).
 */

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const STORAGE_THEME = 'tl-theme';
const STORAGE_MOTION = 'tl-reduce-motion';

export function ThemeProvider({
  children,
  initialTheme = 'dark',
  initialReduceMotion = false,
  persistToServer = false,
}: {
  children: React.ReactNode;
  initialTheme?: ThemeId;
  initialReduceMotion?: boolean;
  persistToServer?: boolean;
}) {
  const [theme, setThemeState] = React.useState<ThemeId>(initialTheme);
  const [reduceMotion, setReduceMotionState] = React.useState(initialReduceMotion);

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_THEME) as ThemeId | null;
    const storedMotion = localStorage.getItem(STORAGE_MOTION);
    if (stored) setThemeState(stored);
    if (storedMotion != null) setReduceMotionState(storedMotion === 'true');
  }, []);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-reduce-motion', String(reduceMotion));
  }, [reduceMotion]);

  const persist = React.useCallback(
    (patch: { theme?: ThemeId; reduceMotion?: boolean }) => {
      if (!persistToServer) return;
      void fetch('/api/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(() => {
        /* La preferencia local ya se aplicó: un fallo de red no debe romper la UI. */
      });
    },
    [persistToServer],
  );

  const setTheme = React.useCallback(
    (t: ThemeId) => {
      setThemeState(t);
      localStorage.setItem(STORAGE_THEME, t);
      persist({ theme: t });
    },
    [persist],
  );

  const setReduceMotion = React.useCallback(
    (v: boolean) => {
      setReduceMotionState(v);
      localStorage.setItem(STORAGE_MOTION, String(v));
      persist({ reduceMotion: v });
    },
    [persist],
  );

  const value = React.useMemo(
    () => ({ theme, setTheme, reduceMotion, setReduceMotion }),
    [theme, setTheme, reduceMotion, setReduceMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider.');
  return ctx;
}

export const THEME_OPTIONS: Array<{ id: ThemeId; label: string; description: string }> = [
  { id: 'dark', label: 'Oscuro', description: 'Experiencia principal, pensada para sesiones largas de estudio.' },
  { id: 'light', label: 'Claro', description: 'Alternativa profesional para entornos muy iluminados.' },
  { id: 'high-contrast', label: 'Alto contraste', description: 'Contraste reforzado y bordes marcados.' },
];

/**
 * Script que aplica el tema antes de pintar, evitando el destello de tema
 * incorrecto. Se inyecta en el `<head>` del layout raíz.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('${STORAGE_THEME}') || 'dark';
    var m = localStorage.getItem('${STORAGE_MOTION}') === 'true';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-reduce-motion', String(m));
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`.trim();
