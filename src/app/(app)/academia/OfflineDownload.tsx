'use client';

import { useCallback, useEffect, useState } from 'react';
import { CloudDownload, Check, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import { Button } from '@tl/ui';
import {
  clearIfForeign,
  clearOffline,
  formatBytes,
  offlineSupported,
  readStatus,
  saveLessons,
  type OfflineStatus,
} from '@/lib/offline-academy';

/**
 * Descarga de la academia para estudiar sin conexión.
 *
 * Es la razón de peso para instalar la aplicación: estudiar en el metro, en un
 * avión o con datos agotados. Solo se descarga material de estudio; el
 * progreso, el diario y las cotizaciones siguen necesitando conexión, y el
 * texto de la interfaz lo dice en lugar de dejarlo a la sorpresa.
 */
export function OfflineDownload() {
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [working, setWorking] = useState<'download' | 'clear' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => setStatus(await readStatus()), []);

  useEffect(() => {
    void refresh();
    const connectivity = () => setOffline(!navigator.onLine);
    connectivity();
    window.addEventListener('online', connectivity);
    window.addEventListener('offline', connectivity);
    return () => {
      window.removeEventListener('online', connectivity);
      window.removeEventListener('offline', connectivity);
    };
  }, [refresh]);

  async function download() {
    setWorking('download');
    setError(null);
    try {
      const response = await fetch('/api/academy/offline', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result?.error?.message ?? 'No pudimos preparar la descarga.');
        return;
      }
      await clearIfForeign(result.data.scope);
      setStatus(await saveLessons(result.data.lessons, result.data.scope));
    } catch {
      setError('No pudimos guardar las lecciones en este dispositivo. Puede que no quede espacio.');
    } finally {
      setWorking(null);
    }
  }

  async function remove() {
    setWorking('clear');
    setError(null);
    try {
      await clearOffline();
      await refresh();
    } finally {
      setWorking(null);
    }
  }

  if (!status) return null;

  if (!status.supported) {
    return (
      <p className="text-[length:var(--text-2xs)] text-[var(--color-subtle)]">
        Este navegador no permite guardar lecciones para leerlas sin conexión.
      </p>
    );
  }

  const downloaded = status.count > 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-overlay)]"
        aria-hidden="true"
      >
        {offline ? (
          <WifiOff size={16} className="text-[var(--color-gold)]" />
        ) : downloaded ? (
          <Check size={16} className="text-[var(--color-positive)]" />
        ) : (
          <CloudDownload size={16} className="text-[var(--color-blue)]" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--text-xs)] font-medium">
          {downloaded ? 'Academia disponible sin conexión' : 'Estudia sin conexión'}
        </p>
        <p className="mt-0.5 text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-muted)]">
          {downloaded ? (
            <>
              <span className="num">{status.count}</span> lecciones guardadas en este dispositivo (
              <span className="num">{formatBytes(status.bytes)}</span>
              {status.savedAt ? `, ${new Date(status.savedAt).toLocaleDateString('es')}` : ''}). El progreso y los
              gráficos en vivo siguen necesitando conexión.
            </>
          ) : (
            'Guarda las lecciones de tu plan en este dispositivo para leerlas en el metro o sin datos. No se guardan cotizaciones, pagos ni datos de tu cuenta.'
          )}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-[length:var(--text-2xs)] text-[var(--color-negative)]">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant={downloaded ? 'outline' : 'primary'} loading={working === 'download'} onClick={download} disabled={offline}>
          {downloaded ? <RefreshCw size={14} aria-hidden="true" /> : <CloudDownload size={14} aria-hidden="true" />}
          {downloaded ? 'Actualizar' : 'Descargar'}
        </Button>
        {downloaded && (
          <Button
            size="sm"
            variant="ghost"
            loading={working === 'clear'}
            onClick={remove}
            aria-label="Borrar las lecciones descargadas"
          >
            <Trash2 size={14} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
