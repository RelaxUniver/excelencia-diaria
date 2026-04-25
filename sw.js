/* ============================================================
   EXCELENCIA DIARIA — Service Worker v3
   Handles: offline cache + scheduled notifications
============================================================ */

const CACHE = 'excl-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

/* ---- INSTALL: cache assets ---- */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

/* ---- ACTIVATE: clean old caches ---- */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ---- FETCH: serve from cache, fallback to network ---- */
self.addEventListener('fetch', e => {
  // Only handle same-origin GET requests
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache successful responses for app assets
        if (res.ok && e.request.url.includes(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback
        return caches.match('./index.html');
      });
    })
  );
});

/* ---- MESSAGES: schedule notifications from main thread ---- */
let notifTimer = null;

self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'SCHEDULE') {
    const { ms, title, body } = e.data;

    // Clear any existing scheduled notification
    if (notifTimer) clearTimeout(notifTimer);

    notifTimer = setTimeout(async () => {
      try {
        await self.registration.showNotification(title || 'Excelencia Diaria', {
          body: body || 'Ya registraste tu dia? El hombre de caracter no descansa en sus habitos.',
          icon: './icon-192.png',
          badge: './icon-192.png',
          vibrate: [200, 100, 200, 100, 200],
          tag: 'daily',
          renotify: true,
          requireInteraction: false
        });

        // Schedule again for the next day (24h later)
        notifTimer = setTimeout(async () => {
          await self.registration.showNotification(title || 'Excelencia Diaria', {
            body: body || 'Ya registraste tu dia? El hombre de caracter no descansa en sus habitos.',
            icon: './icon-192.png',
            badge: './icon-192.png',
            vibrate: [200, 100, 200],
            tag: 'daily',
            renotify: true
          });
        }, 86400000); // 24 hours
      } catch (err) {
        console.error('[SW] Notification error:', err);
      }
    }, ms);

    // Confirm schedule received
    if (e.source) {
      e.source.postMessage({ type: 'SCHEDULE_OK', ms });
    }
  }

  if (e.data.type === 'CANCEL') {
    if (notifTimer) { clearTimeout(notifTimer); notifTimer = null; }
  }
});

/* ---- NOTIFICATION CLICK: open or focus app ---- */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing window if open
      for (const client of list) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});
