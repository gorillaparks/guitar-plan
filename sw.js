/* Guitar Plan service worker.
   html/js/css/json: network-first (always fresh when online, cached copy offline).
   icons: cache-first. Bump CACHE on every deploy so old caches are dropped. */
const CACHE = 'guitar-plan-v5';
const ASSETS = ['./', './index.html', './app.css', './app.js', './audio.js', './data.js', './manifest.json', './schedule.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(u => fetch(new Request(u, {cache: 'reload'})).then(r => { if(r.ok) return c.put(u, r); }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if(e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request; if(req.method !== 'GET') return;
  const url = new URL(req.url); if(url.origin !== location.origin) return;
  if(/\/icons\//.test(url.pathname)){
    e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req)));
    return;
  }
  e.respondWith(fetch(req, {cache: 'no-cache'}).then(r => {
    if(r.ok){ const cp = r.clone(); caches.open(CACHE).then(c => c.put(new Request(url.origin + url.pathname), cp)); }
    return r;
  }).catch(() => caches.match(req, {ignoreSearch: true}).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
