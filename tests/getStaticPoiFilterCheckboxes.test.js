const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Object, Array, String, Number, Boolean, Math, Date, RegExp, Error, Map, Set, Promise, JSON,
    encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN, isFinite,
    atlasSearchIndex: [],
    mapDefinitionPromiseCache: new Map(),
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    navigator: { userAgent: '' },
    MutationObserver: class { observe() {} disconnect() {} },
    window: {
        addEventListener: () => {},
        matchMedia: () => ({ matches: false, addEventListener: () => {} }),
        location: { search: '', pathname: '', hash: '' },
        history: { pushState: () => {}, replaceState: () => {} },
        requestAnimationFrame: (cb) => cb(),
        cancelAnimationFrame: () => {},
        innerHeight: 1000,
        AppConfig: {
            get: (path, fallback) => fallback,
            applyDocumentMetadata: () => {},
            applyThemeTokens: () => {},
            hydrateStaticDom: () => {}
        }
    },
    L: {
        map: () => ({ on: () => {}, setView: () => {} }),
        Icon: { Default: { imagePath: '' } },
        CRS: { Simple: {} },
        latLngBounds: () => ({ extend: () => {}, pad: () => {} }),
        latLng: () => {},
        imageOverlay: () => ({ addTo: () => {} }),
        layerGroup: () => ({ addTo: () => {}, clearLayers: () => {} }),
        control: { zoom: () => ({ addTo: () => {} }) }
    }
};

const elementHandler = {
    get: function(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'classList') return { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false };
        if (prop === 'style') return { setProperty: () => {}, cssText: '' };
        if (prop === 'dataset') return {};
        if (prop === 'addEventListener') return () => {};
        if (prop === 'appendChild') return () => {};
        if (prop === 'setAttribute') return () => {};
        if (prop === 'getAttribute') return () => null;
        if (prop === 'removeAttribute') return () => {};
        if (prop === 'focus') return () => {};
        if (prop === 'getBoundingClientRect') return () => ({ height: 0, width: 0, top: 0, bottom: 0, left: 0, right: 0 });
        if (prop === 'querySelector' || prop === 'closest') return () => new Proxy({}, elementHandler);
        if (prop === 'querySelectorAll' || prop === 'getElementsByTagName' || prop === 'getElementsByClassName') return () => [];
        if (prop === 'children') return [];
        return undefined;
    }
};

let liveCollectionMock = []; // We will mutate this array to simulate live collection changes

sandbox.document = new Proxy({
    addEventListener: () => {},
    getElementById: (id) => {
        if (id === 'poi-filter-container') {
            return {
                getElementsByTagName: () => liveCollectionMock,
                addEventListener: () => {}
            };
        }
        return new Proxy({}, elementHandler);
    },
    createElement: () => new Proxy({}, elementHandler),
    querySelector: () => new Proxy({}, elementHandler),
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    getElementsByClassName: () => [],
    body: new Proxy({}, elementHandler),
    documentElement: new Proxy({}, elementHandler),
    title: ''
}, elementHandler);

vm.createContext(sandbox);
vm.runInContext(appSource, sandbox);

// 1. Initial state (empty live collection)
const emptyResult = sandbox.getStaticPoiFilterCheckboxes();
assert.equal(emptyResult.length, 0, 'Should return empty array when live collection is empty');
assert.equal(Array.isArray(emptyResult), true, 'Should be an array');

// 2. Populate live collection and force a cache rebuild by clearing it
liveCollectionMock.push({ type: 'checkbox', id: '1' });
liveCollectionMock.push({ type: 'checkbox', id: '2' });

vm.runInContext('staticPoiFilterCheckboxesCache = null;', sandbox);
const result1 = sandbox.getStaticPoiFilterCheckboxes();

assert.equal(result1.length, 2, 'Should cache and return array from live collection');
assert.equal(result1[0].id, '1', 'Should match live collection items');
assert.equal(Array.isArray(result1), true, 'Should return a real Array');

// 3. Mutate live collection, but function should return the exact same cached reference
liveCollectionMock.push({ type: 'checkbox', id: '3' });
const result2 = sandbox.getStaticPoiFilterCheckboxes();
assert.equal(result2.length, 2, 'Should return cached array, not update from live collection');
assert.strictEqual(result1, result2, 'Should return the exact same cached reference');

// 4. Force cache clear and verify it rebuilds
vm.runInContext('staticPoiFilterCheckboxesCache = null;', sandbox);
const result3 = sandbox.getStaticPoiFilterCheckboxes();
assert.equal(result3.length, 3, 'Should rebuild cache when cache is null');

console.log('getStaticPoiFilterCheckboxes tests passed');
