'use client';

import { useEffect, useRef, useState } from 'react';

export function PwaRuntime() {
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const requested = useRef(false);
  useEffect(() => {
    const connectivity = () => setOffline(!navigator.onLine);
    connectivity();
    window.addEventListener('online', connectivity);
    window.addEventListener('offline', connectivity);
    let stopped = false;
    const controllerChanged = () => { if (requested.current) window.location.reload(); };
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(registration => {
        if (stopped) return;
        if (registration.waiting) setWaiting(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (!stopped && worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
          });
        });
      }).catch(() => { /* The online app remains usable if installation is unavailable. */ });
    }
    return () => {
      stopped = true;
      window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity);
      navigator.serviceWorker?.removeEventListener('controllerchange', controllerChanged);
    };
  }, []);
  if (offline) return <aside className="pwa-status" role="status">Sin conexión. Los datos pueden estar desactualizados; no se enviarán operaciones offline.</aside>;
  if (!waiting) return null;
  return <aside className="pwa-status" role="status"><span>Hay una nueva versión. Guarda tus cambios antes de actualizar.</span><button disabled={updating} onClick={() => { requested.current = true; setUpdating(true); waiting.postMessage({ type: 'ACTIVATE_UPDATE' }); }}>{updating ? 'Actualizando…' : 'Actualizar app'}</button></aside>;
}
