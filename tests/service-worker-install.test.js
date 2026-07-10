const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('sw.js', 'utf8');
const listeners = new Map();
const fetchCalls = [];
const addAllCalls = [];
const putCalls = [];
const cache = {
    async addAll(assets) {
        addAllCalls.push([...assets]);
    },
    async put(request, response) {
        putCalls.push({ request: String(request), response });
    }
};
const self = {
    location: { href: 'https://maps.hiraeth.wiki/sw.js?v=0.1.39' },
    addEventListener(type, listener) {
        listeners.set(type, listener);
    },
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
        async open() { return cache; },
        async keys() { return []; },
        async delete() { return true; }
    },
    async fetch(url) {
        fetchCalls.push(String(url));
        return new Response(JSON.stringify({ assets: {} }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
    }
});

async function main() {
    let installPromise = null;
    listeners.get('install')({
        waitUntil(promise) {
            installPromise = promise;
        }
    });
    await installPromise;

    assert.deepEqual(fetchCalls, ['site.config.json?v=0.1.39']);
    assert.equal(addAllCalls.length, 1);
    assert.equal(addAllCalls[0].includes('site.config.json?v=0.1.39'), false);
    assert.equal(addAllCalls[0].includes('images/hiraeth-maps-preview.png'), false);
    assert.equal(addAllCalls[0].includes('images/sky-background.webp'), false);
    assert.equal(putCalls.length, 1);
    assert.equal(putCalls[0].request, 'site.config.json?v=0.1.39');
    assert.equal(putCalls[0].response.ok, true);

    console.log('service worker install checks passed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
