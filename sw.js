const C = 'voley-v6';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/ex.json',
  './data/ex_map.json',
  './data/roster_seed.json',
  './data/datos.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(C)
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => undefined))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== C).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'CLEAR_CACHES') {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // 1) navegaciones y HTML: siempre red primero (si no, se queda pegado a una version vieja)
  //    'cache: reload' evita que el http-cache del navegador devuelva un index.html antiguo
  //    que apunte a assets que ya no existen (app muerta tras un build nuevo).
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request, { cache: 'reload' })
        .then((res) => {
          const copy = res.clone();
          caches.open(C).then((c) => c.put(e.request, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 2) datos y configuracion: red primero con respaldo en cache (datos de GitHub)
  if (url.pathname.includes('/data/') || url.pathname.includes('/config/')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(C).then((c) => c.put(e.request, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r || new Response('{}', { headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  // 3) esquemas, iconos y scripts con hash: cache primero (son inmutables)
  const isAsset = url.pathname.includes('/diagrams/') || url.pathname.includes('/icons/') || url.pathname.includes('/assets/');
  if (isAsset) {
    e.respondWith(
      caches.match(e.request).then((hit) => {
        if (hit) return hit;
        return fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(C).then((c) => c.put(e.request, copy)).catch(() => undefined);
          return res;
        }).catch(() => new Response('', { status: 504 }));
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
