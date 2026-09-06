/* Public offline fallback ONLY. Never persist sessions, HTML navigation, APIs,
 * RSC responses, quotes, payments, or user data. No offline request queue. */
const PUBLIC_CACHE = 'tradinglab-public-v5';
const OFFLINE_PAGE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(PUBLIC_CACHE).then(cache => cache.add(new Request(OFFLINE_PAGE, { credentials: 'omit', cache: 'reload' }))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('tradinglab-public-') && key !== PUBLIC_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.mode !== 'navigate' || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(PUBLIC_CACHE);
    return await cache.match(OFFLINE_PAGE) || new Response('TradingLab necesita conexión. Vuelve a intentarlo cuando tengas internet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});

/* ── Notificaciones push ───────────────────────────────────────────────────
 * El servidor envía el texto ya cifrado por el estándar; aquí solo se pinta.
 * No se consulta la red ni la sesión: si el mensaje no se puede leer, se
 * muestra un aviso genérico en lugar de arriesgar un fallo silencioso, porque
 * un `push` sin notificación visible hace que el navegador retire el permiso.
 */
self.addEventListener('push', event => {
  let payload = { title: 'TradingLab', body: 'Tienes algo pendiente en tu ruta de aprendizaje.', url: '/academia', tag: 'general' };
  try {
    const data = event.data?.json();
    if (data && typeof data.title === 'string' && typeof data.body === 'string') {
      payload = { title: data.title, body: data.body, url: typeof data.url === 'string' ? data.url : '/academia', tag: typeof data.tag === 'string' ? data.tag : 'general' };
    }
  } catch {}
  // Solo se abren rutas propias: una URL recibida no puede llevar fuera del sitio.
  const path = payload.url.startsWith('/') && !payload.url.startsWith('//') ? payload.url : '/academia';
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    renotify: false,
    icon: '/app-icon/192',
    badge: '/app-icon/192',
    data: { path },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.path || '/academia';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    // Si la app ya está abierta se reutiliza esa ventana en lugar de acumular pestañas.
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        return client.focus().then(focused => focused.navigate ? focused.navigate(path) : focused);
      }
    }
    return self.clients.openWindow(path);
  }));
});
