/* eslint-disable */
// Bump SW_VERSION to force browsers to fetch a fresh bundle (clears stale JS cache).
const SW_VERSION = '2026-06-02-2';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}
    await self.clients.claim();
  })());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { title: 'Novo pedido', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Novo pedido';
  const options = {
    body: data.body || '',
    icon: '/placeholder.svg',
    badge: '/placeholder.svg',
    tag: data.tag || 'order',
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of allClients) {
      try {
        const u = new URL(c.url);
        if (u.pathname.startsWith(url) || u.pathname === url) { c.focus(); return; }
      } catch (_) {}
    }
    await self.clients.openWindow(url);
  })());
});