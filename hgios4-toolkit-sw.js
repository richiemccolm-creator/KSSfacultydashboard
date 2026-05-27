const CACHE_NAME = 'hgios4-toolkit-v3';
const urlsToCache = [
  './hgios4-toolkit.html',
  './hgios4-toolkit-styles.css',
  './hgios4-toolkit-app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
});
