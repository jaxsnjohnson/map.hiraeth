const { describe, it } = require('node:test');
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

describe('zoomMapBy', () => {
    it('does nothing if map is undefined', () => {
        // App expects map to have an 'on' method right away when initializing app.js
        const mockMap = {
            on: () => {},
            setZoom: () => {}
        };
        const sandbox = createSandbox(mockMap);
        vm.createContext(sandbox);
        vm.runInContext(appSource, sandbox);

        sandbox.map = null; // override after app source is executed
        assert.doesNotThrow(() => {
            sandbox.zoomMapBy(1);
        });
    });

    it('does nothing if map.getZoom is not a function', () => {
        const mockMap = {
            on: () => {},
            setZoom: () => {}
        };
        const sandbox = createSandbox(mockMap);
        vm.createContext(sandbox);
        vm.runInContext(appSource, sandbox);

        assert.doesNotThrow(() => {
            sandbox.zoomMapBy(1);
        });
    });

    it('does nothing if map.setZoom is not a function', () => {
        const mockMap = {
            on: () => {},
            getZoom: () => 5
        };
        const sandbox = createSandbox(mockMap);
        vm.createContext(sandbox);
        vm.runInContext(appSource, sandbox);

        assert.doesNotThrow(() => {
            sandbox.zoomMapBy(1);
        });
    });

    it('sets map zoom by adding delta to current zoom with animation options', () => {
        let setZoomCalled = false;
        let setZoomArgs = null;
        const mockMap = {
            on: () => {},
            getZoom: () => 5,
            setZoom: function(z, opts) {
                setZoomCalled = true;
                setZoomArgs = { z, opts };
            }
        };
        const sandbox = createSandbox(mockMap);
        vm.createContext(sandbox);
        vm.runInContext(appSource, sandbox);

        sandbox.zoomMapBy(2);

        assert.equal(setZoomCalled, true);
        assert.equal(setZoomArgs.z, 7);
        // deepEqual fails sometimes due to object prototype mismatch across VM contexts
        assert.equal(setZoomArgs.opts.animate, true);
    });

    it('sets map zoom correctly with negative delta', () => {
        let setZoomCalled = false;
        let setZoomArgs = null;
        const mockMap = {
            on: () => {},
            getZoom: () => 5,
            setZoom: function(z, opts) {
                setZoomCalled = true;
                setZoomArgs = { z, opts };
            }
        };
        const sandbox = createSandbox(mockMap);
        vm.createContext(sandbox);
        vm.runInContext(appSource, sandbox);

        sandbox.zoomMapBy(-2);

        assert.equal(setZoomCalled, true);
        assert.equal(setZoomArgs.z, 3);
        assert.equal(setZoomArgs.opts.animate, true);
    });
});
