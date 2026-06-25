/* =========================================================
   Weather Pro — Service Worker
   Minimal "app shell" cache so the app can install as a PWA.
   Live weather data itself always comes from the network
   (Open-Meteo / BigDataCloud) — it is never cached here.
========================================================= */
const CACHE_NAME = 'weather-pro-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never cache live weather / geocoding / location API calls —
  // they must always be fresh.
  if (
    url.includes('open-meteo.com') ||
    url.includes('bigdatacloud.net')
  ) {
    return; // let the browser fetch normally, no SW interception
  }

  // App shell files: serve from cache first, fall back to network.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});