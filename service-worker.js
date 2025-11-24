// =====================================================
// Spider Tools – CLEAN Service Worker (FINAL VERSION)
// =====================================================

const CACHE_NAME = 'spiders-v3.0.1';

// Only cache the app shell — NEVER the JSON
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(k => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Always fetch JSON directly — never from cache
  if (url.includes('fails-data.json') || url.includes('calculator-data.json')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached ||
        fetch(event.request).catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});



// Allow skipWaiting
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
