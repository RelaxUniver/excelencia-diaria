/* ============================================================
   EXCELENCIA DIARIA — Service Worker v3
   Handles: offline cache + scheduled notifications
============================================================ */

const CACHE = 'excl-v3';
const BASE = '/excelencia-diaria';  /* CAMBIO: ruta base para GitHub Pages */
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png'
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
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.url.includes(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        return caches.match(BASE + '/index.html');  /* CAMBIO */
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

    if (notifTimer) clearTimeout(notifTimer);

    notifTimer = setTimeout(async () => {
      try {
        await self.registration.showNotification(title || 'Excelencia Diaria', {
          body: body || 'Ya registraste tu dia? El hombre de caracter no descansa en sus habitos.',
          icon: BASE + '/icon-192.png',   /* CAMBIO */
          badge: BASE + '/icon-192.png',  /* CAMBIO */
          vibrate: [200, 100, 200, 100, 200],
          tag: 'daily',
          renotify: true,
          requireInteraction: false
        });

        notifTimer = setTimeout(async () => {
          await self.registration.showNotification(title || 'Excelencia Diaria', {
            body: body || 'Ya registraste tu dia? El hombre de caracter no descansa en sus habitos.',
            icon: BASE + '/icon-192.png',   /* CAMBIO */
            badge: BASE + '/icon-192.png',  /* CAMBIO */
            vibrate: [200, 100, 200],
            tag: 'daily',
            renotify: true
          });
        }, 86400000);
      } catch (err) {
        console.error('[SW] Notification error:', err);
      }
    }, ms);

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
      for (const client of list) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(BASE + '/index.html');  /* CAMBIO */
    })
  );
});