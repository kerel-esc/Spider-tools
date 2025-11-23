// Cache name (change version to force refresh)
const CACHE_NAME = 'spiders-tools-v3-1.1.0';

// Files to cache for offline use
const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './logo.png'
  // fails-data.json and calculator-data.json are cached optionally
];

// Install: cache core files + optional data files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(FILES_TO_CACHE);

      // Optionally cache fails-data.json
      try {
        const respFails = await fetch('./fails-data.json', { cache: 'no-store' });
        if (respFails.ok) {
          await cache.put('./fails-data.json', respFails.clone());
        }
      } catch (_) {
        // Safe to ignore if missing or offline
      }

      // Optionally cache calculator-data.json
      try {
        const respCalc = await fetch('./calculator-data.json', { cache: 'no-store' });
        if (respCalc.ok) {
          await cache.put('./calculator-data.json', respCalc.clone());
        }
      } catch (_) {
        // Safe to ignore if missing or offline
      }
    })
  );
  self.skipWaiting();
});

// Activate: clear old caches
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

// Fetch: serve from cache first, then network, then fallback
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() =>
          caches.match('./index.html') // fallback if offline
        )
      );
    })
  );
});

// Allow page to trigger skipWaiting for updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
