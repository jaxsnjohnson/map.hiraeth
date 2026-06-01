const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionSource(name) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < appSource.length; i += 1) {
        const char = appSource[i];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }
    if (end === -1) {
        throw new Error(`Could not parse function ${name}`);
    }
    return appSource.slice(start, end);
}

const populatePOIsOnMapSource = extractFunctionSource('populatePOIsOnMap');

// Setup mock environment
global.visiblePointsCache = [];
// Need these so the real function doesn't throw ReferenceError
global.allMapMarkers = [];
global.allMapMarkersById = new Map();
global.allMapMarkersByName = new Map();

// Mock console methods so tests are clean
global.console = {
    ...console,
    warn: () => {},
    error: () => {}
};

// Mock functions needed by the real implementation
global.getPoiGroup = () => 'group';
global.getPoiIcon = () => 'icon';
global.createPopupContent = () => 'popup';
global.createPoiTooltipContent = () => 'tooltip';
global.getPoiTooltipOptions = () => ({});
global.attachPoiTooltipBehavior = (marker) => { marker.behaviorAttached = true; };
global.trackAnalytics = () => {};

let lMarkerCallCount = 0;
let lastMarkerCoords = null;
let shouldLMarkerThrow = false;

// Mock Leaflet
global.L = {
    marker: (coords, options) => {
        if (shouldLMarkerThrow) {
            throw new Error('Leaflet mock error');
        }
        lMarkerCallCount++;
        lastMarkerCoords = coords;
        return {
            coords,
            options,
            bindPopup: function() {},
            bindTooltip: function() {}
        };
    }
};

// Evaluate the function source code
// eslint-disable-next-line no-eval
eval(populatePOIsOnMapSource);

function resetMocks() {
    global.visiblePointsCache = [];
    global.allMapMarkers = [];
    global.allMapMarkersById.clear();
    global.allMapMarkersByName.clear();
    lMarkerCallCount = 0;
    lastMarkerCoords = null;
    shouldLMarkerThrow = false;
}

// Test Suite
(function runTests() {
    // Test 1: Happy path - valid coordinates within bounds
    resetMocks();
    global.visiblePointsCache = [
        { coords: [50, 50], type: 'Town' }
    ];

    populatePOIsOnMap({ height: 100, width: 100 });

    assert.equal(lMarkerCallCount, 1, 'Should call L.marker for valid coords');
    assert.deepEqual(lastMarkerCoords, [50, 50], 'Should pass correct coords to L.marker');

    // Test 2: Out of bounds coords (negative or exceeding dimensions)
    resetMocks();
    global.visiblePointsCache = [
        { coords: [150, 50], type: 'Town' }, // height > 100
        { coords: [50, -10], type: 'Town' }, // width < 0
        { coords: [-1, 50], type: 'Town' }, // height < 0
        { coords: [50, 150], type: 'Town' } // width > 100
    ];

    populatePOIsOnMap({ height: 100, width: 100 });

    assert.equal(lMarkerCallCount, 0, 'Should not call L.marker for out of bounds coords');

    // Test 3: Invalid coordinates (missing, wrong length, NaN)
    resetMocks();
    global.visiblePointsCache = [
        { type: 'Town' }, // missing coords
        { coords: [50, NaN], type: 'Town' }, // NaN value
        { coords: [50], type: 'Town' }, // wrong length
        { coords: ['invalid', 'string'], type: 'Town' } // non-numbers
    ];

    populatePOIsOnMap({ height: 100, width: 100 });

    assert.equal(lMarkerCallCount, 0, 'Should not call L.marker for invalid coords');

    // Test 4: Exception thrown during marker creation
    resetMocks();
    shouldLMarkerThrow = true;
    global.visiblePointsCache = [
        { coords: [50, 50], type: 'Town' }
    ];

    // Should not throw up the stack due to the internal try/catch catching it
    assert.doesNotThrow(() => {
        populatePOIsOnMap({ height: 100, width: 100 });
    }, 'Internal try/catch should prevent exception from bubbling up');

    console.info('populatePOIsOnMap regression checks passed');
})();
