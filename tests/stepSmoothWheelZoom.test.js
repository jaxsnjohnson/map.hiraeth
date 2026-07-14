const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function createSandbox(mapMock) {
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
            requestAnimationFrame: (cb) => {
                sandbox._rafCallbacks = sandbox._rafCallbacks || [];
                sandbox._rafCallbacks.push(cb);
                sandbox._rafId = (sandbox._rafId || 0) + 1;
                return sandbox._rafId;
            },
            cancelAnimationFrame: () => {},
            innerHeight: 1000,
            AppConfig: {
                get: (path, fallback) => fallback,
                applyDocumentMetadata: () => {},
                applyThemeTokens: () => {},
                hydrateStaticDom: () => {}
            },
            SharedUtils: {
                debounce: (fn) => fn,
                withAssetVersion: (url) => url,
                fetchJsonAsset: () => Promise.resolve({})
            }
        },
        L: {
            map: () => mapMock,
            Icon: { Default: { imagePath: '' } },
            CRS: { Simple: {} },
            latLngBounds: () => ({ extend: () => {}, pad: () => {} }),
            latLng: () => {},
            imageOverlay: () => ({ addTo: () => {} }),
            layerGroup: () => ({ addTo: () => {}, clearLayers: () => {} }),
            control: { zoom: () => ({ addTo: () => {} }) }
        },
        HTMLImageElement: class {}
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

    return sandbox;
}

let globalSandbox;
let globalMapMock;
let setZoomCalled = false;
let nextZoomValue = null;
let animateArg = null;
let getZoomCalls = 0;

globalMapMock = {
    on: () => {},
    getZoom: () => {
        getZoomCalls++;
        return getZoomCalls === 1 ? globalSandbox._mockGetZoomFirst : globalSandbox._mockGetZoomSecond;
    },
    setZoomAround: (anchor, nextZoom, opts) => {
        setZoomCalled = true;
        nextZoomValue = nextZoom;
        animateArg = opts.animate;
    }
};

describe('stepSmoothWheelZoom', () => {
    beforeEach(() => {
        if (!globalSandbox) {
            globalSandbox = createSandbox(globalMapMock);
            globalSandbox.requestAnimationFrame = globalSandbox.window.requestAnimationFrame;

            vm.createContext(globalSandbox);
            vm.runInContext(appSource, globalSandbox);
        }

        // Reset state for each test
        setZoomCalled = false;
        nextZoomValue = null;
        animateArg = null;
        getZoomCalls = 0;
        globalSandbox._mockGetZoomFirst = 5.0;
        globalSandbox._mockGetZoomSecond = 5.0;

        // Reset local variables
        vm.runInContext(`
            smoothWheelFrameId = null;
            smoothWheelTargetZoom = null;
            smoothWheelAnchorPoint = null;

            // Fix map's clampZoomLevel so we don't depend on actual map data bounds returning modified values
            clampZoomLevel = (z) => z;
        `, globalSandbox);
    });

    it('returns early if smoothWheelAnchorPoint is falsy', () => {
        vm.runInContext(`
            smoothWheelFrameId = 123;
            smoothWheelTargetZoom = 6;
            smoothWheelAnchorPoint = null;

            stepSmoothWheelZoom();

            globalThis.testResult = smoothWheelFrameId;
        `, globalSandbox);

        assert.equal(globalSandbox.testResult, null);
        assert.equal(setZoomCalled, false);
    });

    it('returns early if smoothWheelTargetZoom is null', () => {
        vm.runInContext(`
            smoothWheelFrameId = 123;
            smoothWheelTargetZoom = null;
            smoothWheelAnchorPoint = { x: 10, y: 10 };

            stepSmoothWheelZoom();

            globalThis.testResult = smoothWheelFrameId;
        `, globalSandbox);

        assert.equal(globalSandbox.testResult, null);
        assert.equal(setZoomCalled, false);
    });

    it('snaps to target zoom and cancels animation when delta is small', () => {
        globalSandbox._mockGetZoomFirst = 5.0; // diff is 0 <= SMOOTH_WHEEL_SETTLE_DELTA
        vm.runInContext(`
            smoothWheelFrameId = 123;
            smoothWheelTargetZoom = 5.0;
            smoothWheelAnchorPoint = { x: 10, y: 10 };

            stepSmoothWheelZoom();

            globalThis.testResult = smoothWheelFrameId;
        `, globalSandbox);

        assert.equal(globalSandbox.testResult, null);
        assert.equal(setZoomCalled, true);
        assert.equal(nextZoomValue, 5.0); // Exact match because of conditional in app.js and mocked clampZoomLevel
        assert.equal(animateArg, false);
    });

    it('eases towards target zoom when delta is large', () => {
        globalSandbox._mockGetZoomFirst = 5.0;
        globalSandbox._mockGetZoomSecond = 5.5;
        vm.runInContext(`
            smoothWheelFrameId = 123;
            smoothWheelTargetZoom = 6.0;
            smoothWheelAnchorPoint = { x: 10, y: 10 };

            const oldSchedule2 = scheduleSmoothWheelFrame;
            scheduleSmoothWheelFrame = () => { smoothWheelFrameId = 999; };

            stepSmoothWheelZoom();

            globalThis.testResult = smoothWheelFrameId;

            scheduleSmoothWheelFrame = oldSchedule2;
        `, globalSandbox);

        assert.equal(setZoomCalled, true);
        assert.ok(nextZoomValue > 5.0 && nextZoomValue < 6.0);
        assert.equal(animateArg, false);
        assert.equal(globalSandbox.testResult, 999);
    });
});
