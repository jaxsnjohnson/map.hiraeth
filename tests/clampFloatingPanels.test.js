const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const elementHandler = {
    get: function(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'classList') return { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false };
        if (prop === 'style') return target.style || { setProperty: () => {}, cssText: '' };
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
        SharedUtils: {
            fetchJsonAsset: () => Promise.resolve({}),
            withAssetVersion: (url) => url
        },
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

sandbox.document = new Proxy({
    addEventListener: () => {},
    getElementById: (id) => {
        if (id === 'bottom-link-bar') return { style: { display: 'none' }, getBoundingClientRect: () => ({ height: 0 }) };
        return new Proxy({ id, style: {} }, elementHandler);
    },
    createElement: () => new Proxy({ style: {} }, elementHandler),
    querySelector: () => new Proxy({ style: {} }, elementHandler),
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    getElementsByClassName: () => [],
    body: new Proxy({}, elementHandler),
    documentElement: new Proxy({}, elementHandler),
    title: ''
}, elementHandler);

vm.createContext(sandbox);
vm.runInContext(appSource, sandbox);

// Expose mock elements to the sandbox
const routePanel = { style: { maxHeight: '100px', top: '10px', right: '10px', left: '10px' } };
const sessionToolkitPanel = { style: { maxHeight: '100px', top: '10px', right: '10px', left: '10px' } };
const gmPill = { style: { maxHeight: '100px', top: '10px', right: '10px', left: '10px' } };

sandbox.routePanel = routePanel;
sandbox.sessionToolkitPanel = sessionToolkitPanel;
sandbox.gmPill = gmPill;

// Test 1: Should not do anything if mobileLayoutV2Enabled is true AND isMobileLayoutActive is true
sandbox.mobileLayoutV2Enabled = true;
sandbox.isMobileLayoutActive = true;
sandbox.clampFloatingPanels();
assert.equal(routePanel.style.maxHeight, '100px');

// Test 2: Should not do anything if mobileLayoutV2Enabled is false
sandbox.mobileLayoutV2Enabled = false;
sandbox.isMobileLayoutActive = false;
sandbox.clampFloatingPanels();
assert.equal(routePanel.style.maxHeight, '100px');

// Test 3: Should clear styles if mobileLayoutV2Enabled is true and isMobileLayoutActive is false
sandbox.mobileLayoutV2Enabled = true;
sandbox.isMobileLayoutActive = false;
sandbox.clampFloatingPanels();
assert.equal(routePanel.style.maxHeight, '');
assert.equal(routePanel.style.top, '');
assert.equal(routePanel.style.right, '');
assert.equal(routePanel.style.left, '');

assert.equal(sessionToolkitPanel.style.maxHeight, '');
assert.equal(sessionToolkitPanel.style.top, '');
assert.equal(sessionToolkitPanel.style.right, '');
assert.equal(sessionToolkitPanel.style.left, '');

assert.equal(gmPill.style.maxHeight, '');
assert.equal(gmPill.style.top, '');
assert.equal(gmPill.style.right, '');
assert.equal(gmPill.style.left, '');

// Test 4: Should gracefully handle null elements
sandbox.routePanel = null;
sandbox.sessionToolkitPanel = null;
sandbox.gmPill = null;
sandbox.mobileLayoutV2Enabled = true;
sandbox.isMobileLayoutActive = false;
assert.doesNotThrow(() => sandbox.clampFloatingPanels());

console.log('clampFloatingPanels tests passed');
