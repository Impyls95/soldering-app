/* Service Worker: офлайн-доступ к урокам и оболочке приложения. */
const CACHE_VERSION = 'soldering-app-v1.3.0';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/images.js',
  './js/quiz.js',
  './js/app.js',
  './images/soldering-iron.jpg',
  './images/third-hand.jpg',
  './images/soldering-pcb.jpg',
  './images/safety.svg',
  './images/water-analogy.svg',
  './images/ohm-law.svg',
  './images/resistors.svg',
  './images/capacitor.svg',
  './images/diode-led.svg',
  './images/transistor-npn.svg',
  './images/transistor-mosfet.svg',
  './images/voltage-divider.svg',
  './images/blinker.svg',
  './images/solder-joints.svg',
  './images/quiz.svg',
  './images/placeholder.svg',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => {
        /* Первую установку активируем сразу; обновление ждёт команды из app.js. */
        if (!self.registration.active) return self.skipWaiting();
        return undefined;
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* Навигация: сначала сеть, офлайн — сохранённая главная страница. */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./')))
    );
    return;
  }

  /* Статика: из кэша, при промахе — из сети с сохранением. */
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          if (request.destination === 'image') return caches.match('./images/placeholder.svg');
          return new Response('Ресурс недоступен офлайн.', {
            status: 504,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
    })
  );
});
