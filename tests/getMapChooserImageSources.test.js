const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Object, Array, String, Number, Boolean, Math, Date, RegExp, Error, Map, Set, Promise, JSON, Intl,
    encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN, isFinite,
    MutationObserver: class { observe() {} disconnect() {} },
    navigator: { userAgent: '' },
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

// Test null/undefined mapInfo
assert.deepEqual(sandbox.getMapChooserImageSources(null), {
    preview: '',
    fallback: ''
});

// Test basic image URL
assert.deepEqual(sandbox.getMapChooserImageSources({ imageUrl: 'maps/default.webp' }), {
    preview: 'maps/default.mini.webp',
    fallback: 'maps/default.webp'
});

// Test URLs with query parameters and hash
assert.deepEqual(sandbox.getMapChooserImageSources({ imageUrl: 'maps/default.webp?v=1#test' }), {
    preview: 'maps/default.mini.webp?v=1#test',
    fallback: 'maps/default.webp?v=1#test'
});

// Test with Mobile Layout Overrides
vm.runInContext('mobileLayoutV2Enabled = true; isMobileLayoutActive = true;', sandbox);
assert.deepEqual(sandbox.getMapChooserImageSources({
    imageUrl: 'maps/default.webp',
    imageVariants: { mobile: 'maps/mobile.webp' }
}), {
    preview: 'maps/mobile.mini.webp',
    fallback: 'maps/mobile.webp'
});

console.log('getMapChooserImageSources tests passed');