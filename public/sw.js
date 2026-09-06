/* Public offline fallback ONLY. Never persist sessions, HTML navigation, APIs,
 * RSC responses, quotes, payments, or user data. No offline request queue. */
const PUBLIC_CACHE = 'tradinglab-public-v2';
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
