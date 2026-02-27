// Push notification service worker handler
// This file is imported by the main PWA service worker via importScripts

self.addEventListener('push', function(event) {
  let data = {};
  
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Notificação', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || '🎯 Arb From 073';
  const options = {
    body: data.body || '',
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    tag: data.tag || 'arb073-notification',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window if none found
      return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('pushsubscriptionchange', function(event) {
  // Handle subscription changes (e.g., browser refreshed subscription)
  console.log('Push subscription changed');
});
