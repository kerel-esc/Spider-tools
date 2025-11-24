// =====================================
// Spider Tools – Service Worker
// =====================================

const CACHE_NAME = 'spiders-tools-v1.1.8'; // bumped version

const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './logo.png'
  // ⛔ JSON files intentionally NOT cached here
];

// Install: cache core shell files only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
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

  // ⛔ Let JSON requests go straight to the network.
  // Script.js already uses `cache: 'no-store'` and has its own fallback.
  if (
    url.pathname.endsWith('/fails-data.json') ||
    url.pathname.endsWith('/calculator-data.json') ||
    url.pathname.endsWith('fails-data.json') ||
    url.pathname.endsWith('calculator-data.json')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else (app shell)
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
