// Mexxie PWA Service Worker v1.0
var CACHE_NAME = 'mexxie-stocks-v1';
var ASSETS = [
  './',
  './mexxie_v2_editorial_enhanced.html',
  './mexxie_world_stock_enhanced.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@700;800&display=swap'
];

// Install: cache all core assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
          .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: network-first for API calls, cache-first for assets
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // API calls (Finnhub, FMP) - always network, never cache
  if (url.indexOf('finnhub.io') !== -1 || url.indexOf('financialmodelingprep.com') !== -1) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Everything else: cache-first, fallback to network
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        // Cache successful responses for future offline use
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      });
    }).catch(function() {
      // Offline fallback - return cached index if available
      if (e.request.mode === 'navigate') {
        return caches.match('./mexxie_v2_editorial_enhanced.html');
      }
    })
  );
});
