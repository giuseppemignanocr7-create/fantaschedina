// Notifiche push (Web Push via Firebase Cloud Messaging).
//
// Questo file viene incluso nel service worker generato da vite-plugin-pwa
// (workbox.importScripts): un solo SW per cache e notifiche. Non usa l'SDK
// Firebase: FCM consegna un normale Web Push con { notification, data },
// e qui basta mostrarlo e aprire l'app al tocco.

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { notification: { body: event.data ? event.data.text() : '' } };
  }
  const n = payload.notification || {};
  const d = payload.data || {};
  const url = (payload.fcmOptions && payload.fcmOptions.link) || d.url || '/';
  event.waitUntil(
    self.registration.showNotification(n.title || d.title || 'Fantaschedina', {
      body: n.body || d.body || '',
      icon: n.icon || '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
