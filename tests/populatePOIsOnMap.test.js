const assert = require('node:assert/strict');
const { afterEach, beforeEach, describe, it } = require('node:test');
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

function createSpy(implementation = () => undefined) {
    const spy = (...args) => {
        spy.calls.push(args);
        return implementation(...args);
    };
    spy.calls = [];
    return spy;
}

const populatePOIsOnMapSource = extractFunctionSource('populatePOIsOnMap');
let populatePOIsOnMap;

// eslint-disable-next-line no-eval
eval(`populatePOIsOnMap = ${populatePOIsOnMapSource}`);

describe('populatePOIsOnMap', () => {
    let originalConsoleWarn;
    let originalConsoleError;
    let markerSpy;
    let warnSpy;
    let errorSpy;
    let trackAnalyticsSpy;

    beforeEach(() => {
        originalConsoleWarn = console.warn;
        originalConsoleError = console.error;
        warnSpy = createSpy();
        errorSpy = createSpy();
        console.warn = warnSpy;
        console.error = errorSpy;

        markerSpy = createSpy((coords, options) => {
            if (options.icon === 'trigger-undefined') return undefined;
            return {
                coords,
                options,
                bindPopup: createSpy(),
                bindTooltip: createSpy()
            };
        });

        global.L = { marker: markerSpy };
        global.getPoiGroup = type => type;
        global.getPoiIcon = group => {
            if (group === 'trigger-error') throw new Error('Simulated exception');
            return group;
        };
        global.createPopupContent = () => 'popup';
        global.createPoiTooltipContent = () => 'tooltip';
        global.getPoiTooltipOptions = () => ({});
        global.attachPoiTooltipBehavior = marker => { marker.behaviorAttached = true; };
        trackAnalyticsSpy = createSpy();
        global.trackAnalytics = trackAnalyticsSpy;

        global.visiblePointsCache = [];
        global.allMapMarkers = [];
        global.allMapMarkersById = new Map();
        global.allMapMarkersByName = new Map();
    });

    afterEach(() => {
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
    });

    it('adds valid POIs to marker caches', () => {
        global.visiblePointsCache = [
            { id: '1', name: 'Valid POI 1', type: 'Settlement', coords: [50, 50] },
            { id: '2', name: 'Valid POI 2', type: 'Dungeon', coords: [10, 90] }
        ];

        populatePOIsOnMap({ width: 100, height: 100, name: 'Test Map' });

        assert.equal(markerSpy.calls.length, 2);
        assert.equal(global.allMapMarkers.length, 2);
        assert.equal(global.allMapMarkersById.size, 2);
        assert.equal(global.allMapMarkersByName.size, 2);
        assert.equal(global.allMapMarkersById.has('1'), true);
        assert.equal(global.allMapMarkersByName.has('Valid POI 2'), true);
        assert.equal(warnSpy.calls.length, 0);
        assert.equal(errorSpy.calls.length, 0);
    });

    it('ignores invalid coordinates and logs warnings', () => {
        global.visiblePointsCache = [
            { id: '3', name: 'Bad Coords 1', type: 'Settlement', coords: [NaN, 50] },
            { id: '4', name: 'Bad Coords 2', type: 'Settlement', coords: [50] },
            { id: '5', name: 'Bad Coords 3', type: 'Settlement' }
        ];

        populatePOIsOnMap({ width: 100, height: 100, name: 'Test Map' });

        assert.equal(global.allMapMarkers.length, 0);
        assert.equal(markerSpy.calls.length, 0);
        assert.equal(warnSpy.calls.length, 3);
        assert.deepEqual(warnSpy.calls[0], ['Invalid coordinates for POI: Bad Coords 1', [NaN, 50]]);
    });

    it('ignores out-of-bounds coordinates and logs warnings', () => {
        global.visiblePointsCache = [
            { id: '6', name: 'Out of bounds 1', type: 'Settlement', coords: [-10, 50] },
            { id: '7', name: 'Out of bounds 2', type: 'Settlement', coords: [50, 150] }
        ];

        populatePOIsOnMap({ width: 100, height: 100, name: 'Small Map' });

        assert.equal(global.allMapMarkers.length, 0);
        assert.equal(markerSpy.calls.length, 0);
        assert.equal(warnSpy.calls.length, 2);
        assert.deepEqual(warnSpy.calls[0], [
            'POI coordinates out of bounds for map Small Map: Out of bounds 1',
            [-10, 50]
        ]);
    });

    it('handles undefined markers gracefully', () => {
        global.visiblePointsCache = [
            { id: '8', name: 'Undefined Marker POI', type: 'trigger-undefined', coords: [50, 50] }
        ];

        populatePOIsOnMap({ width: 100, height: 100, name: 'Test Map' });

        assert.equal(global.allMapMarkers.length, 0);
        assert.equal(warnSpy.calls.length, 1);
        assert.deepEqual(warnSpy.calls[0], ['L.marker returned undefined for POI: Undefined Marker POI']);
    });

    it('logs unexpected POI processing errors and continues', () => {
        global.visiblePointsCache = [
            { id: '9', name: 'Error POI', type: 'trigger-error', coords: [50, 50] },
            { id: '10', name: 'Valid POI', type: 'Settlement', coords: [20, 20] }
        ];

        assert.doesNotThrow(() => {
            populatePOIsOnMap({ width: 100, height: 100, name: 'Error Map' });
        });

        assert.equal(global.allMapMarkers.length, 1);
        assert.equal(errorSpy.calls.length, 1);
        assert.deepEqual(warnSpy.calls[0], ['Encountered 1 errors while processing POIs for map Error Map.']);
        assert.deepEqual(trackAnalyticsSpy.calls[0], [
            'poi_processing_error',
            {
                poiName: 'Error POI',
                errorMessage: 'Simulated exception'
            }
        ]);
    });
});
