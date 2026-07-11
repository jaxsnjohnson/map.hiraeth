const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('sw.js', 'utf8');
const listeners = new Map();
const putCalls = [];
let releasePut;
const putGate = new Promise((resolve) => {
    releasePut = resolve;
});

const self = {
    location: {
        href: 'https://maps.hiraeth.wiki/sw.js?v=0.1.39',
        origin: 'https://maps.hiraeth.wiki'
    },
    addEventListener(type, listener) {
        listeners.set(type, listener);
    }
};

vm.runInNewContext(source, {
    URL,
    Request,
    Response,
    console,
    self,
    caches: {
        async open() {
            return {
                async match() {
                    return undefined;
                },
                async put(request) {
                    putCalls.push(request.url || String(request));
                    await putGate;
                }
            };
        }
    },
    async fetch() {
        return new Response('{"ok":true}', {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
    }
});

async function main() {
    const request = new Request('https://maps.hiraeth.wiki/maps/atlas-index.json?v=0.1.39');
    let responsePromise;
    const lifetimePromises = [];
    listeners.get('fetch')({
        request,
        respondWith(promise) {
            responsePromise = Promise.resolve(promise);
        },
        waitUntil(promise) {
            lifetimePromises.push(Promise.resolve(promise));
        }
    });

    assert.equal(lifetimePromises.length, 1, 'cache work should be registered synchronously');
    const response = await responsePromise;
    assert.deepEqual(await response.json(), { ok: true });
    assert.deepEqual(putCalls, [request.url]);

    let lifetimeSettled = false;
    const lifetimeDone = Promise.all(lifetimePromises).then(() => {
        lifetimeSettled = true;
    });
    await Promise.resolve();
    assert.equal(lifetimeSettled, false, 'the fetch event should remain alive while cache.put is pending');

    releasePut();
    await lifetimeDone;
    assert.equal(lifetimeSettled, true);

    console.log('service worker cache lifetime checks passed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
