// Mexxie PWA Service Worker
// v1.1 — vibrant-edison: removes deleted Editorial/WorldStock entries (the
// previous addAll list referenced files that no longer ship, which made
// install fail atomically and left the PWA without offline support).
// HTML is now network-first so newly-deployed HTML lands without a cache bump.
// API calls (Railway / Finnhub / FMP / EODHD / Twelve) are never cached.
var CACHE_NAME = 'mexxie-stocks-v1.1';

// Static assets that ship with the deploy. Anything 404'd here would break
// cache.addAll atomically — keep this list to files we actually publish.
var STATIC_ASSETS = [
  './',
  './index.html',
  './mexxie_prism.html',
  './Mexxie_Ultimate_v5.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Fonts — best-effort cache, never fatal to install
var FONT_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@700;800&display=swap'
];

function isApiRequest(url) {
  return url.indexOf('/api/') !== -1 ||
         url.indexOf('finnhub.io') !== -1 ||
         url.indexOf('financialmodelingprep.com') !== -1 ||
         url.indexOf('eodhistoricaldata.com') !== -1 ||
         url.indexOf('eodhd.com') !== -1 ||
         url.indexOf('twelvedata.com') !== -1 ||
         url.indexOf('railway.app') !== -1;
}

function isHtml(req) {
  if (req.mode === 'navigate') return true;
  var accept = req.headers.get('accept') || '';
  return accept.indexOf('text/html') !== -1;
}

self.addEventListener('install', function(e) {
  e.waitUntil((async function() {
    var cache = await caches.open(CACHE_NAME);
    // Required static assets — atomic. If any 404 here, install fails (a real bug we want surfaced).
    await cache.addAll(STATIC_ASSETS);
    // Fonts: best-effort. A single 404 must not break install.
    await Promise.all(FONT_ASSETS.map(function(u) {
      return cache.add(u).catch(function(){ /* ignore */ });
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function(e) {
  e.waitUntil((async function() {
    var names = await caches.keys();
    await Promise.all(names.filter(function(n) { return n !== CACHE_NAME; })
      .map(function(n) { return caches.delete(n); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;            // POST / PUT / DELETE always pass through
  var url = req.url;
  if (isApiRequest(url)) return;               // Live data — never serve from SW cache

  // HTML: network-first so newly-deployed HTML wins; cache only as offline fallback.
  if (isHtml(req)) {
    e.respondWith((async function() {
      try {
        var fresh = await fetch(req);
        if (fresh && fresh.ok) {
          var copy = fresh.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(req, copy); });
        }
        return fresh;
      } catch (err) {
        var cached = await caches.match(req);
        if (cached) return cached;
        var shell = await caches.match('./mexxie_prism.html');
        if (shell) return shell;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Static assets: cache-first, populate on miss.
  e.respondWith((async function() {
    var cached = await caches.match(req);
    if (cached) return cached;
    try {
      var resp = await fetch(req);
      if (resp && resp.status === 200) {
        var copy = resp.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(req, copy); });
      }
      return resp;
    } catch (err) {
      // Always return a Response — undefined breaks fetch in some browsers.
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
