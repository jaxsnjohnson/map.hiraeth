const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const appSource = fs.readFileSync('js/app.js', 'utf8');

test('normalizeWheelDelta', async (t) => {
    const mockNode = {
        querySelector: () => mockNode,
        querySelectorAll: () => [mockNode],
        getElementsByTagName: () => [mockNode],
        getElementsByClassName: () => [mockNode],
        addEventListener: () => {},
        style: { setProperty: () => {}, removeProperty: () => {} },
        classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
        setAttribute: () => {},
        getAttribute: () => null,
        removeAttribute: () => {},
        appendChild: () => {},
        removeChild: () => {},
        focus: () => {},
        blur: () => {},
        getBoundingClientRect: () => ({ height: 50, width: 50, top: 0, left: 0 }),
        innerText: '',
        innerHTML: '',
        checked: false,
        dataset: {}
    };

    const sandbox = {
        window: {
            innerHeight: 1000,
            innerWidth: 1000,
            addEventListener: () => {},
            removeEventListener: () => {},
            matchMedia: () => ({ matches: false, addEventListener: () => {} }),
            localStorage: { getItem: () => null, setItem: () => {} },
            sessionStorage: { getItem: () => null, setItem: () => {} },
            location: { hash: '', search: '', pathname: '/', href: 'http://localhost/' },
            visualViewport: { height: 1000, addEventListener: () => {} }
        },
        document: {
            documentElement: mockNode,
            body: mockNode,
            getElementById: () => mockNode,
            querySelector: () => mockNode,
            querySelectorAll: () => [mockNode],
            createElement: () => mockNode,
            addEventListener: () => {}
        },
        navigator: { userAgent: '' },
        MutationObserver: class {
            observe() {}
            disconnect() {}
        },
        SharedUtils: {
            debounce: (fn) => fn,
            fetchJsonAsset: async () => ({ tree: {} }), // Return valid tree to avoid error log
            withAssetVersion: (url) => url
        },
        AppConfig: null,
        console: { ...console, error: () => {} }, // suppress expected errors
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        URL: class {
            constructor(url, base) {
                this.searchParams = new URLSearchParams('');
                this.pathname = '/';
                this.hash = '';
            }
        },
        URLSearchParams: class {
            constructor() {}
            get() { return null; }
            set() {}
            has() { return false; }
            delete() {}
            toString() { return ''; }
        },
        location: { hash: '', search: '', pathname: '/' },
        history: { replaceState: () => {}, pushState: () => {} },
        L: { // mock Leaflet
            map: () => ({
                on: () => {},
                whenReady: () => {},
                getContainer: () => ({ focus: () => {} }),
                getSize: () => ({ x: 100, y: 100 }),
                setMinZoom: () => {},
                setMaxZoom: () => {},
                setZoom: () => {},
                setView: () => {},
                getBounds: () => ({ getCenter: () => ({}) })
            }),
            Icon: { Default: { imagePath: '' } },
            CRS: { Simple: {} },
            Control: { extend: () => function() {} },
            DomUtil: { create: () => ({}) },
            layerGroup: () => ({ addTo: () => ({}) }),
            markerClusterGroup: () => ({ addTo: () => ({}) })
        },
        fetch: async () => ({ json: async () => ({}) })
    };

    sandbox.window.SharedUtils = sandbox.SharedUtils;
    vm.createContext(sandbox);
    vm.runInContext(appSource, sandbox);

    await t.test('deltaMode 0 (Pixel)', () => {
        sandbox.window.innerHeight = 1000;
        const result = sandbox.normalizeWheelDelta({ deltaY: 100, deltaMode: 0 });
        assert.equal(result, 100);
    });

    await t.test('deltaMode 1 (Line)', () => {
        sandbox.window.innerHeight = 1000;
        const result = sandbox.normalizeWheelDelta({ deltaY: 2, deltaMode: 1 });
        assert.equal(result, 32);
    });

    await t.test('deltaMode 2 (Page) with valid innerHeight', () => {
        sandbox.window.innerHeight = 1000;
        const result = sandbox.normalizeWheelDelta({ deltaY: 1, deltaMode: 2 });
        assert.equal(result, 1000);
    });

    await t.test('deltaMode 2 (Page) with small innerHeight', () => {
        sandbox.window.innerHeight = 100;
        const result = sandbox.normalizeWheelDelta({ deltaY: 1, deltaMode: 2 });
        assert.equal(result, 240);
    });

    await t.test('handles missing or non-numeric deltaY', () => {
        sandbox.window.innerHeight = 1000;
        const result = sandbox.normalizeWheelDelta({ deltaMode: 0 });
        assert.equal(result, 0);

        const result2 = sandbox.normalizeWheelDelta({ deltaY: 'abc', deltaMode: 0 });
        assert.equal(result2, 0);
    });
});
