// MED-TRACE Service Worker with Network-First Strategy for Instant Live Updates
const CACHE_NAME = 'med-trace-v2.1';
const ASSETS_TO_CACHE = [
  './',
  './Med Trace.html',
  './style.css',
  './features.css',
  './script.js',
  './features.js',
  './pharmacy.js',
  './reminders.js',
  './logo.jpg',
  './icon-192.png',
  './icon-512.png',
  './hero.jpg',
  './doctor_a.jpg',
  './doctor_b.jpg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Cache addAll warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Purging legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First Strategy: fetch fresh content, update cache, fallback to cache if offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('./Med Trace.html');
        });
      })
  );
});
