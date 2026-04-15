var CACHE_NAME = 'sqt-v14';
var ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/na-logo.png',
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
    e.respondWith(
        caches.match(e.request).then(function(cached) {
            return cached || fetch(e.request);
        })
    );
});
