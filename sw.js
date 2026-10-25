var V = 'mr-202610242238', CORE = ["./", "index.html", "dc-lite.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "Main.dc.html", "Alimentacao.dc.html", "Capoeira.dc.html", "Surf.dc.html", "Berimbau.dc.html", "Pandeiro.dc.html", "Atabaque.dc.html", "Violao.dc.html", "Harmonica.dc.html"];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== V && k !== 'mr-media'; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) e.respondWith(caches.open('mr-media').then(function (c) { return c.match(r).then(function (hit) { return hit || fetch(r).then(function (res) { c.put(r, res.clone()); return res; }); }); }));
    return;
  }
  if (u.pathname.indexOf('/media/') >= 0) {
    if (r.headers.get('range')) return;
    e.respondWith(caches.open('mr-media').then(function (c) { return c.match(r).then(function (hit) { return hit || fetch(r).then(function (res) { if (res.ok && res.status === 200 && !/\.mp4$/.test(u.pathname)) c.put(r, res.clone()); return res; }); }); }));
    return;
  }
  var fresh = u.href + (u.search ? '&' : '?') + '_v=' + Date.now();
  e.respondWith(fetch(fresh, { cache: 'no-store', credentials: 'same-origin' }).then(function (res) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); return res; }).catch(function () { return caches.match(r, { ignoreSearch: true }); }));
});
