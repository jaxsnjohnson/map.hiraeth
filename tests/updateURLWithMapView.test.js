const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const timeoutStart = appSource.indexOf('let viewUpdateTimeout;');
const helperStart = appSource.indexOf('function updateURLWithMapView() {');
const helperEnd = appSource.indexOf('// --- Helper Functions for loadMap ---');

if (
    timeoutStart === -1 ||
    helperStart === -1 ||
    helperEnd === -1 ||
    helperEnd <= helperStart
) {
    throw new Error('Could not locate updateURLWithMapView in js/app.js');
}

const helperSource = [
    appSource.slice(timeoutStart, timeoutStart + 'let viewUpdateTimeout;'.length),
    appSource.slice(helperStart, helperEnd)
].join('\n');

const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;

let scheduledTimeout = null;
const clearedTimeoutIds = [];
global.setTimeout = (callback, delay) => {
    scheduledTimeout = { callback, delay };
    return 'persist-view-timeout';
};
global.clearTimeout = (timeoutId) => {
    clearedTimeoutIds.push(timeoutId);
};

let replaceStateCalls = 0;
global.history = {
    state: { mapId: 'icebeach' },
    replaceState: () => {
        replaceStateCalls += 1;
    }
};

global.window = {
    location: {
        href: 'https://maps.hiraeth.wiki/?view=old-view#icebeach-s=o',
        search: '?view=old-view',
        hash: '#icebeach-s=o'
    }
};
global.map = {
    getCenter() {
        return { lat: 18.123456, lng: -27.654321 };
    },
    getZoom() {
        return 3;
    }
};
global.currentlyLoadedMapId = 'icebeach';
global.UX_STORAGE_KEYS = { lastMapId: 'lastMapId' };

const savedViews = [];
global.saveMapView = (mapId, viewValue) => {
    savedViews.push({ mapId, viewValue });
};

const storedValues = [];
global.safeSetStorage = (key, value) => {
    storedValues.push({ key, value });
};

try {
    // eslint-disable-next-line no-eval
    eval(helperSource);

    updateURLWithMapView();

    assert.equal(scheduledTimeout.delay, 500);
    assert.deepEqual(savedViews, []);

    scheduledTimeout.callback();

    assert.deepEqual(savedViews, [
        { mapId: 'icebeach', viewValue: '18.1235,-27.6543,3' }
    ]);
    assert.deepEqual(storedValues, [
        { key: 'lastMapId', value: 'icebeach' }
    ]);
    assert.equal(replaceStateCalls, 0, 'passive map movement should not rewrite the URL');
    assert.equal(window.location.search, '?view=old-view');

    updateURLWithMapView();
    assert.ok(clearedTimeoutIds.includes('persist-view-timeout'));
} finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
}

console.log('updateURLWithMapView regression checks passed');
