const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const dummyElement = {
    querySelector: () => dummyElement,
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: () => {}, display: '' },
    appendChild: () => {},
    addEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    closest: () => dummyElement,
    getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }),
    textContent: '',
    innerHTML: '',
    dataset: {}
};

const sandbox = {
    window: {
        matchMedia: () => ({ matches: false, addEventListener: () => {} }),
        innerWidth: 1024,
        innerHeight: 768,
        location: { search: '', hash: '', pathname: '' },
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        visualViewport: { addEventListener: () => {} },
        addEventListener: () => {},
        SharedUtils: {
            debounce: (fn) => fn,
            withAssetVersion: (url) => url,
            fetchJsonAsset: () => Promise.resolve({ tree: [], searchIndex: [] })
        }
    },
    document: {
        documentElement: dummyElement,
        body: dummyElement,
        getElementById: () => dummyElement,
        querySelector: () => dummyElement,
        querySelectorAll: () => [],
        createElement: () => dummyElement,
        addEventListener: () => {}
    },
    navigator: { userAgent: '' },
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Object,
    Array,
    Math,
    Promise,
    JSON,
    Date,
    L: {
        CRS: { Simple: {} },
        map: () => ({ on: () => {}, off: () => {} }),
        layerGroup: () => ({ addTo: () => {} }),
        icon: () => ({}),
    },
    location: { search: '', hash: '', pathname: '' },
    history: { pushState: () => {}, replaceState: () => {}, state: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    fetch: () => Promise.resolve(),
    Number,
    String,
    Boolean,
    Set,
    Map,
    WeakMap,
    Intl,
    performance: { now: () => 0 },
    URLSearchParams,
    URL,
    DOMParser: class DOMParser { parseFromString() { return { body: dummyElement }; } },
    MutationObserver: class MutationObserver { observe() {} disconnect() {} },
};

vm.createContext(sandbox);
vm.runInContext(appSource, sandbox);

const isMapChooserArchiveEntry = sandbox.isMapChooserArchiveEntry;

// 1. Matches via ancestor branch text (category/group context)
assert.equal(isMapChooserArchiveEntry({ id: 'map1', name: 'Map 1' }, [{ name: 'Archive' }]), true);
assert.equal(isMapChooserArchiveEntry({ id: 'map1', name: 'Map 1' }, [{ group: 'Old Dev Maps' }]), true);
assert.equal(isMapChooserArchiveEntry({ id: 'map1', name: 'Map 1' }, [{ category: 'IRL Old Maps' }]), true);

// 2. Matches via direct item id prefix
assert.equal(isMapChooserArchiveEntry({ id: 'OLD-map1', name: 'Map 1' }), true);
assert.equal(isMapChooserArchiveEntry({ id: 'DEV-map1', name: 'Map 1' }), true);
assert.equal(isMapChooserArchiveEntry({ id: 'Archive-map1', name: 'Map 1' }), true);
assert.equal(isMapChooserArchiveEntry({ id: 'old-map1', name: 'Map 1' }), true); // Case insensitive

// 3. Matches via direct item name prefix
assert.equal(isMapChooserArchiveEntry({ id: 'map1', name: 'OLD-Map 1' }), true);
assert.equal(isMapChooserArchiveEntry({ id: 'map1', name: 'DEV-Map 1' }), true);
assert.equal(isMapChooserArchiveEntry({ id: 'map1', name: 'Archive-Map 1' }), true);

// 4. Does not match when no indicators are present
assert.equal(isMapChooserArchiveEntry({ id: 'map1', name: 'Map 1' }), false);
assert.equal(isMapChooserArchiveEntry({ id: 'map1', name: 'Map 1' }, [{ name: 'Current Maps' }]), false);
assert.equal(isMapChooserArchiveEntry({ id: 'new-DEV-map', name: 'Map 1' }), false); // Prefix must be at start
assert.equal(isMapChooserArchiveEntry({ id: 'map1', name: 'The OLD-Map' }), false); // Prefix must be at start

// 5. Handles null/undefined inputs gracefully
assert.equal(isMapChooserArchiveEntry(null), false);
assert.equal(isMapChooserArchiveEntry(undefined), false);

// 6. Trims whitespace before testing
assert.equal(isMapChooserArchiveEntry({ id: '  OLD-map  ', name: '  Map 1  ' }), true);
assert.equal(isMapChooserArchiveEntry({ id: 'map1', name: 'Map 1' }, [{ name: '  Archive  ' }]), true);

console.log('isMapChooserArchiveEntry tests passed');
