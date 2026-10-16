const C = 'voley-v2';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/ex.json',
  './data/ex_map.json',
  './data/roster_seed.json'
];
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(C).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()).catch(() => undefined)
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isAsset = url.pathname.includes('/diagrams/') || url.pathname.includes('/data/') || url.pathname.includes('/icons/');
  if (e.request.method === 'GET' && (isAsset || PRECACHE.some((p) => url.pathname.endsWith(p.replace('./', '/'))))) {
    e.respondWith(
      caches.match(e.request).then((hit) => {
        if (hit) return hit;
        return fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(C).then((c) => c.put(e.request, copy)).catch(() => undefined);
          return res;
        }).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
