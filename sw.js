/* ================================
   РАКЕТА · Service Worker v7
   Network-first + авто-обновление
================================ */
const VERSION = 'raketa-v7';
const STATIC  = ['/loyalty.html', '/index.html', '/admin-x7k2m.html', '/icon.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(VERSION).then(c =>
      Promise.allSettled(STATIC.map(url => c.add(url).catch(() => {})))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;
  if (e.request.url.includes('api.telegram.org')) return;

  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'GET_VERSION')  e.source.postMessage({ type: 'VERSION', version: VERSION });
});
