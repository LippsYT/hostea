/* eslint-disable no-restricted-globals */
const CACHE_VERSION = 'hostea-sw-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'Hostea';
  const body = payload.body || 'Tenes una nueva notificacion.';
  const url = payload.url || '/dashboard';
  const tag = payload.tag || payload.type || 'GENERAL';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: 'hostea',
      renotify: true,
      data: { url, tag },
      vibrate: [200, 100, 200],
      silent: false
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/dashboard';

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const absoluteUrl = new URL(targetUrl, self.location.origin).toString();
      for (const client of windows) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          client.navigate(absoluteUrl);
          client.focus();
          return;
        }
      }
      await clients.openWindow(absoluteUrl);
    })()
  );
});
