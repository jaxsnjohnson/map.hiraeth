const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('sw.js', 'utf8');
const listeners = new Map();
const cacheStores = new Map();
const fetchCalls = [];
const deletedCaches = [];

function getCache(name) {
    if (!cacheStores.has(name)) cacheStores.set(name, new Map());
    const store = cacheStores.get(name);
    return {
        async match(request) {
            return store.get(request.url || String(request))?.clone() || undefined;
        },
        async put(request, response) {
            store.set(request.url || String(request), response.clone());
        },
        async keys() {
            return Array.from(store.keys()).map((url) => new Request(url));
        },
        async delete(request) {
            return store.delete(request.url || String(request));
        },
        async addAll() {}
    };
}

cacheStores.set('hag-assets-old', new Map());

const self = {
    location: {
        href: 'https://maps.hiraeth.wiki/sw.js?v=0.1.39',
        origin: 'https://maps.hiraeth.wiki'
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
    async skipWaiting() {},
    clients: { async claim() {} }
};

vm.runInNewContext(source, {
    URL,
    Request,
    Response,
    console,
    self,
    caches: {
        async open(name) { return getCache(name); },
        async keys() { return Array.from(cacheStores.keys()); },
        async delete(name) {
            deletedCaches.push(name);
            return cacheStores.delete(name);
        }
    },
    async fetch(request) {
        fetchCalls.push(request.url || String(request));
        return new Response('tile-pixels', { status: 200, headers: { 'content-type': 'image/webp' } });
    }
});

async function dispatchFetch(request) {
    let responsePromise = null;
    const lifetimePromises = [];
    listeners.get('fetch')({
        request,
        respondWith(promise) { responsePromise = Promise.resolve(promise); },
        waitUntil(promise) { lifetimePromises.push(Promise.resolve(promise)); }
    });
    const response = await responsePromise;
    await Promise.all(lifetimePromises);
    return response;
}

async function main() {
    const tileRequest = new Request('https://maps.hiraeth.wiki/tile/main_continent/5/10/10.webp?v=abc123');
    const firstResponse = await dispatchFetch(tileRequest);
    assert.equal(await firstResponse.text(), 'tile-pixels');
    assert.deepEqual(fetchCalls, [tileRequest.url]);
    assert.equal(cacheStores.get('hag-tiles-v1').has(tileRequest.url), true);

    const cachedResponse = await dispatchFetch(tileRequest);
    assert.equal(await cachedResponse.text(), 'tile-pixels');
    assert.deepEqual(fetchCalls, [tileRequest.url], 'repeat tile requests should survive shell releases in the stable cache');

    let activatePromise = null;
    listeners.get('activate')({ waitUntil(promise) { activatePromise = promise; } });
    await activatePromise;
    assert.equal(deletedCaches.includes('hag-assets-old'), true);
    assert.equal(deletedCaches.includes('hag-tiles-v1'), false);
    assert.equal(cacheStores.has('hag-tiles-v1'), true);

    console.log('service worker persistent tile cache checks passed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
