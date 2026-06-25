const VERSION = new URL(self.location.href).searchParams.get('v') || '0';
const SHELL_CACHE = `hag-shell-${VERSION}`;
const DATA_CACHE = `hag-data-${VERSION}`;
const ASSET_CACHE = `hag-assets-${VERSION}`;
const ALL_CACHES = [SHELL_CACHE, DATA_CACHE, ASSET_CACHE];

const DEFAULT_VERSIONED_SHELL_ASSETS = [
    'css/leaflet.css',
    'css/style.css',
    'css/stars.css',
    'css/Control.MiniMap.min.css',
    'js/app-config.js',
    'js/shared-utils.js',
    'js/libs/leaflet.js',
    'js/libs/lucide.min.js',
    'js/libs/purify.min.js',
    'js/app.js',
    'js/starfield.js',
    'js/libs/Control.MiniMap.min.js',
    'maps/atlas-index.json',
    'site.config.json'
];

const DEFAULT_STATIC_SHELL_ASSETS = [
    './',
    'index.html',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon.png',
    'apple-touch-icon.png',
    'images/sky-background.webp',
    'images/clouds.webp',
    'images/toggle.svg',
    'css/images/marker-icon.png',
    'css/images/marker-icon-2x.png',
    'css/images/marker-shadow.png',
    'images/hiraeth-maps-preview.png',
    'images/poi-icons/settlements.svg',
    'images/poi-icons/structures.svg',
    'images/poi-icons/natural-features.svg',
    'images/poi-icons/other.svg',
    'images/poi-icons/unknown.svg'
];

function versionAsset(asset) {
    if (!asset || asset === './') return asset;
    return asset.includes('?') ? `${asset}&v=${VERSION}` : `${asset}?v=${VERSION}`;
}

async function loadShellAssetConfig() {
    try {
        const response = await fetch(`site.config.json?v=${VERSION}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Config returned ${response.status}`);
        const config = await response.json();
        return {
            versioned: Array.isArray(config?.assets?.serviceWorker?.versionedShellAssets)
                ? config.assets.serviceWorker.versionedShellAssets
                : DEFAULT_VERSIONED_SHELL_ASSETS,
            static: Array.isArray(config?.assets?.serviceWorker?.staticShellAssets)
                ? config.assets.serviceWorker.staticShellAssets
                : DEFAULT_STATIC_SHELL_ASSETS
        };
    } catch (error) {
        return {
            versioned: DEFAULT_VERSIONED_SHELL_ASSETS,
            static: DEFAULT_STATIC_SHELL_ASSETS
        };
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const configuredAssets = await loadShellAssetConfig();
        const versionedShellAssets = configuredAssets.versioned.map(versionAsset);
        const cache = await caches.open(SHELL_CACHE);
        await cache.addAll([...configuredAssets.static, ...versionedShellAssets]);
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

function isVersionedShellRequest(url) {
    return url.searchParams.has('v');
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
        url.pathname.endsWith('.js')
    ) {
        event.respondWith(isVersionedShellRequest(url)
            ? staleWhileRevalidate(request, SHELL_CACHE)
            : networkFirst(request, SHELL_CACHE));
        return;
    }

    if (
        url.pathname === '/' ||
        url.pathname.endsWith('.html')
    ) {
        event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    }
});
