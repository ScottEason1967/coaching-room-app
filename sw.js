// Offline support. Online: always fetch the latest files (so updates appear
// straight away) and keep a copy. Offline or slow: use the saved copy.
const CACHE = 'coaching-room-v13';
const SHELL = [
  './',
  'css/app.css',
  'fonts/barlow-condensed-latin-500-normal.woff2',
  'fonts/barlow-condensed-latin-600-normal.woff2',
  'fonts/barlow-condensed-latin-700-normal.woff2',
  'fonts/inter-latin-400-normal.woff2',
  'fonts/inter-latin-500-normal.woff2',
  'fonts/inter-latin-600-normal.woff2',
  'fonts/inter-latin-700-normal.woff2',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'index.html',
  'js/app.js',
  'js/challenges.js',
  'js/cloud.js',
  'js/config.js',
  'js/help.js',
  'js/pitch.js',
  'js/print.js',
  'js/store.js',
  'js/templates.js',
  'js/util.js',
  'js/view.js',
  'js/views/block.js',
  'js/views/board.js',
  'js/views/drill.js',
  'js/views/home.js',
  'js/views/ideas.js',
  'js/views/match.js',
  'js/views/model.js',
  'js/views/more.js',
  'js/views/hubs.js',
  'js/views/review.js',
  'js/views/session.js',
  'js/views/sharing.js',
  'js/views/squad.js',
  'manifest.webmanifest',
  'vendor/supabase.js',
  'view.html',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // database calls go straight to the network
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
    net.catch(() => {});
    const timeout = new Promise(r => setTimeout(r, 3500));
    try {
      const res = await Promise.race([net, timeout]);
      if (res) return res;
    } catch (err) { /* offline */ }
    const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    if (hit) return hit;
    return net; // nothing cached: wait for the network after all
  })());
});
