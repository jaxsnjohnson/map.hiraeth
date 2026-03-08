const VERSION = new URL(self.location.href).searchParams.get('v') || '0';
const SHELL_CACHE = `hag-shell-${VERSION}`;
const DATA_CACHE = `hag-data-${VERSION}`;
const ASSET_CACHE = `hag-assets-${VERSION}`;
const ALL_CACHES = [SHELL_CACHE, DATA_CACHE, ASSET_CACHE];

const VERSIONED_SHELL_ASSETS = [
    `css/style.css?v=${VERSION}`,
    `css/stars.css?v=${VERSION}`,
    `css/Control.MiniMap.min.css?v=${VERSION}`,
    `js/app.js?v=${VERSION}`,
    `js/starfield.js?v=${VERSION}`,
    `js/libs/Control.MiniMap.min.js?v=${VERSION}`,
    `maps/atlas-index.json?v=${VERSION}`
];

const STATIC_SHELL_ASSETS = [
    './',
    'index.html',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon.png',
    'apple-touch-icon.png',
    'images/clouds.webp',
    'images/toggle.svg',
    'images/hiraeth-maps-preview.png',
    'images/poi-icons/settlements.png',
    'images/poi-icons/structures.png',
    'images/poi-icons/natural-features.png',
    'images/poi-icons/other.png',
    'images/poi-icons/unknown.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        await cache.addAll([...STATIC_SHELL_ASSETS, ...VERSIONED_SHELL_ASSETS]);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => {
            if (!ALL_CACHES.includes(key)) {
                return caches.delete(key);
            }
            return Promise.resolve(false);
        }));
        await self.clients.claim();
    })());
});

async function networkFirst(request, cacheName, fallbackRequest = null) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (fallbackRequest) {
            const fallback = await caches.match(fallbackRequest);
            if (fallback) return fallback;
        }
        throw error;
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const networkPromise = fetch(request)
        .then((response) => {
            if (response && response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => cached);
    return cached || networkPromise;
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, SHELL_CACHE, 'index.html'));
        return;
    }

    if (url.pathname.endsWith('.json')) {
        event.respondWith(networkFirst(request, DATA_CACHE));
        return;
    }

    if (
        url.pathname.endsWith('.webp') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpeg') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.mp3')
    ) {
        event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
        return;
    }

    if (
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js') ||
        url.pathname === '/' ||
        url.pathname.endsWith('.html')
    ) {
        event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    }
});
