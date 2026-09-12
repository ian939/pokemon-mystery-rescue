const CACHE_NAME = 'mystery-rescue-v12';
const APP_SHELL = new URL('./', self.registration.scope).href;
const CORE = [
  './',
  './manifest.webmanifest',
  './icons/app-icon.svg',
  './icons/app-icon-512.png',
  './assets/app.js',
  './assets/app.css',
  './fonts/jua.woff2',
  './fonts/gaegu-700.woff2',
  './assets/rewards/charizard-official.png',
  './assets/rewards/snorlax-official.png',
  './assets/rewards/gengar-official.png',
  './assets/rewards/blastoise-official.png',
  './assets/rewards/pikachu-ending.webp',
  './assets/rewards/eevee-ending.webp',
].map((path) => new URL(path, self.registration.scope).href);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request, { ignoreVary: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => (event.request.mode === 'navigate' ? caches.match(APP_SHELL, { ignoreVary: true }) : cached));
    }),
  );
});
