const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const sandbox = {
    SEARCH_SCOPE_ATLAS: 'atlas',
    SEARCH_SCOPE_MAP: 'map',
    currentSearchScope: 'map',
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
        SharedUtils: { debounce: (fn) => fn, withAssetVersion: (url) => url, fetchJsonAsset: () => Promise.resolve({}) },
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
            hydrateStaticDom: () => {} // Added hydrateStaticDom
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

sandbox.document = new Proxy({
    addEventListener: () => {},
    getElementById: () => new Proxy({}, elementHandler),
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

// Default behavior when no config overrides
assert.equal(sandbox.getSearchScopeLabel(sandbox.SEARCH_SCOPE_ATLAS), 'Atlas');
assert.equal(sandbox.getSearchScopeLabel('map'), 'This Map');

vm.runInContext("currentSearchScope = SEARCH_SCOPE_ATLAS;", sandbox);
assert.equal(vm.runInContext('getSearchScopeLabel()', sandbox), 'Atlas');

vm.runInContext("currentSearchScope = 'map';", sandbox);
assert.equal(vm.runInContext('getSearchScopeLabel()', sandbox), 'This Map');

// Override config behavior
sandbox.window.AppConfig.get = (path, fallback) => {
    if (path === 'taxonomy.labels.atlasSearchScope') return 'Custom Atlas';
    if (path === 'taxonomy.labels.mapSearchScope') return 'Custom Map';
    return fallback;
};

assert.equal(sandbox.getSearchScopeLabel(sandbox.SEARCH_SCOPE_ATLAS), 'Custom Atlas');
assert.equal(sandbox.getSearchScopeLabel('map'), 'Custom Map');

console.log('getSearchScopeLabel tests passed');
