var CACHE_NAME = 'sqt-v38';
var ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/na-logo.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './css/variables.css',
    './css/screens.css',
    './css/components.css',
    './js/storage.js',
    './js/roster.js',
    './js/plays.js',
    './js/game.js',
    './js/tracker.js',
    './js/dashboard.js',
    './js/export.js',
    './js/app.js'
];

self.addEventListener('install', function(e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.filter(function(n) { return n !== CACHE_NAME; })
                     .map(function(n) { return caches.delete(n); })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', function(e) {
    // Stale-while-revalidate: return cache immediately, update cache from network in background
    e.respondWith(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.match(e.request).then(function(cached) {
                var networkFetch = fetch(e.request).then(function(response) {
                    if (response && response.ok) {
                        cache.put(e.request, response.clone());
                    }
                    return response;
                }).catch(function() { return null; });
                return cached || networkFetch;
            });
        })
    );
});
