const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');

class MockHTMLImageElement {
    constructor() {
        this.dataset = {};
        this.src = '';
    }
}

const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Object, Array, String, Number, Boolean, Math, Date, RegExp, Error, Map, Set, Promise, JSON, Intl,
    encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN, isFinite,
    MutationObserver: class { observe() {} disconnect() {} },
    navigator: { userAgent: '' },
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
    HTMLImageElement: MockHTMLImageElement
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
// Case 1: currentTarget is not an HTMLImageElement
{
    const event = { currentTarget: {} };
    sandbox.handleMapChooserImageError(event);
    assert.equal(event.currentTarget.src, undefined);
}

// Case 2: currentTarget is an HTMLImageElement but no fallbackSrc
{
    const image = new sandbox.HTMLImageElement();
    const event = { currentTarget: image };
    sandbox.handleMapChooserImageError(event);
    assert.equal(image.src, '');
}

// Case 3: currentTarget is an HTMLImageElement and has fallbackSrc
{
    const image = new sandbox.HTMLImageElement();
    image.dataset.fallbackSrc = 'fallback.webp';
    const event = { currentTarget: image };
    sandbox.handleMapChooserImageError(event);
    assert.equal(image.src, 'fallback.webp');
    assert.equal(image.dataset.fallbackSrc, undefined);
}

console.log('handleMapChooserImageError tests passed');
