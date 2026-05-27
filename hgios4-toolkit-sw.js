const CACHE_NAME = 'hgios4-toolkit-v6';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('hgios4-toolkit-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  var isToolkit =
    url.pathname.endsWith('hgios4-toolkit-app.js') ||
    url.pathname.endsWith('hgios4-toolkit-hub-bridge.js') ||
    url.pathname.endsWith('curriculum-units.js') ||
    url.pathname.endsWith('hgios4-toolkit.html') ||
    url.pathname.endsWith('hgios4-toolkit-styles.css');

  if (isToolkit) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
});
