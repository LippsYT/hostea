/* eslint-disable no-restricted-globals */
const CACHE_VERSION = 'hostea-sw-v1';

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
  const url = payload.url || '/dashboard/host/messages';
  const type = payload.type || 'GENERAL';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `${type}:${url}`,
      data: { url, type },
      vibrate: [180, 60, 180],
      renotify: true,
      silent: false
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/dashboard/host/messages';

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          client.focus();
          return;
        }
      }
      await clients.openWindow(targetUrl);
    })()
  );
});

