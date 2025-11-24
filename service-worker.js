// =====================================
// Spider Tools – Service Worker
// =====================================

const CACHE_NAME = 'spiders-tools-v4.0.0';

const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './logo.png',
  './fails-data.json',
  './calculator-data.json'
];

// Install: cache core files + data files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(FILES_TO_CACHE);

      // Try to refresh JSON from network (optional, but nice if online)
      try {
        const failsRes = await fetch('./fails-data.json');
        if (failsRes.ok) {
          await cache.put('./fails-data.json', failsRes.clone());
        }
      } catch (_) {}

      try {
        const calcRes = await fetch('./calculator-data.json');
        if (calcRes.ok) {
          await cache.put('./calculator-data.json', calcRes.clone());
        }
      } catch (_) {}
    })
  );

  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first for JSON data files
  if (
    url.pathname.endsWith('/fails-data.json') ||
    url.pathname.endsWith('/calculator-data.json') ||
    url.pathname.endsWith('fails-data.json') ||
    url.pathname.endsWith('calculator-data.json')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Save latest copy into cache
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, res.clone());
            return res;
          });
        })
        .catch(() => {
          // If offline or fetch fails, try cached version
          return caches.match(event.request);
        })
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => {
          // Optional: fallback to index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        })
      );
    })
  );
});

// Allow page to trigger skipWaiting (used by update banner)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
