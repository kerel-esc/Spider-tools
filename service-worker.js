// Cache name (change version to force refresh)
const CACHE_NAME = 'spiders-tools-v2';

// Files to cache for offline use
const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './logo.png'
  // Note: spiders-data.json is intentionally NOT cached here.
  // If it is missing, the app will use built-in defaults.
];

// Install: cache files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
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
