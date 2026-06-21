const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Object, Array, String, Number, Boolean, Math, Date, RegExp, Error, Map, Set, Promise, JSON,
    encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN, isFinite,
    navigator: { userAgent: '' },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
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
    },
    MutationObserver: class { observe() {} disconnect() {} }
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

// Test cases
// We need to use the actual values because MOBILE_SURFACE_MODE_ATLAS and MOBILE_SURFACE_MODE_TOOLS are scoped with const in js/app.js
assert.equal(sandbox.normalizeMobileSurfaceMode('atlas'), 'atlas');
assert.equal(sandbox.normalizeMobileSurfaceMode('tools'), 'tools');
assert.equal(sandbox.normalizeMobileSurfaceMode('invalid'), 'search');
assert.equal(sandbox.normalizeMobileSurfaceMode(''), 'search');
assert.equal(sandbox.normalizeMobileSurfaceMode(null), 'search');
assert.equal(sandbox.normalizeMobileSurfaceMode(undefined), 'search');

console.log('normalizeMobileSurfaceMode tests passed');
