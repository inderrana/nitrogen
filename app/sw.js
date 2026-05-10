/* Nitrogen service worker - simple cache-first for app shell, network-first for HTML */
const VERSION = 'v2';
const SHELL = `nitrogen-shell-${VERSION}`;
const RUNTIME = `nitrogen-runtime-${VERSION}`;

const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/crypto-utils.js',
    '/user-profile.js',
    '/favicon.svg',
    '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Never cache cross-origin (weather APIs etc.)
    if (url.origin !== self.location.origin) return;

    // HTML: network-first so updates are picked up immediately, fallback to cache offline
    if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
        event.respondWith(
            fetch(req).then((res) => {
                const copy = res.clone();
                caches.open(RUNTIME).then((c) => c.put(req, copy));
                return res;
            }).catch(() => caches.match(req).then((m) => m || caches.match('/index.html')))
        );
        return;
    }

    // Static assets: cache-first, then fill from network
    event.respondWith(
        caches.match(req).then((cached) => cached || fetch(req).then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
                const copy = res.clone();
                caches.open(RUNTIME).then((c) => c.put(req, copy));
            }
            return res;
        }).catch(() => cached))
    );
});
