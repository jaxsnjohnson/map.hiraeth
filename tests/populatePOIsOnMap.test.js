import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import * as fs from 'node:fs';

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

let populatePOIsOnMap;

describe('populatePOIsOnMap', () => {
    let originalConsoleWarn;
    let originalConsoleError;

    beforeEach(() => {
        // Mock Leaflet
        global.L = {
            marker: vi.fn((coords, options) => {
                if (options.icon === 'trigger-undefined') return undefined;
                return {
                    bindPopup: vi.fn(),
                    bindTooltip: vi.fn(),
                };
            })
        };

        // Mock dependencies
        global.getPoiGroup = vi.fn((type) => type);
        global.getPoiIcon = vi.fn((group) => {
            if (group === 'trigger-error') throw new Error('Simulated exception');
            return group;
        });
        global.createPopupContent = vi.fn();
        global.createPoiTooltipContent = vi.fn();
        global.getPoiTooltipOptions = vi.fn();
        global.attachPoiTooltipBehavior = vi.fn();
        global.trackAnalytics = vi.fn();

        // Mock State Variables
        global.visiblePointsCache = [];
        global.allMapMarkers = [];
        global.allMapMarkersById = new Map();
        global.allMapMarkersByName = new Map();

        // Mock Console
        originalConsoleWarn = console.warn;
        originalConsoleError = console.error;
        console.warn = vi.fn();
        console.error = vi.fn();

        // Evaluate function
        eval(`populatePOIsOnMap = ${populatePOIsOnMapSource}`);
    });

    afterEach(() => {
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
        vi.restoreAllMocks();
    });

    it('should successfully add valid POIs to map caches', () => {
        const selectedMap = { width: 100, height: 100, name: 'Test Map' };
        global.visiblePointsCache = [
            { id: '1', name: 'Valid POI 1', type: 'Settlement', coords: [50, 50] },
            { id: '2', name: 'Valid POI 2', type: 'Dungeon', coords: [10, 90] }
        ];

        populatePOIsOnMap(selectedMap);

        expect(global.allMapMarkers.length).toBe(2);
        expect(global.allMapMarkersById.size).toBe(2);
        expect(global.allMapMarkersByName.size).toBe(2);
        expect(global.allMapMarkersById.has('1')).toBe(true);
        expect(global.allMapMarkersByName.has('Valid POI 2')).toBe(true);
        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
    });

    it('should ignore POIs with invalid coordinates and log a warning', () => {
        const selectedMap = { width: 100, height: 100, name: 'Test Map' };
        global.visiblePointsCache = [
            { id: '3', name: 'Bad Coords 1', type: 'Settlement', coords: [NaN, 50] },
            { id: '4', name: 'Bad Coords 2', type: 'Settlement', coords: [50] }, // Wrong length
            { id: '5', name: 'Bad Coords 3', type: 'Settlement' } // Missing coords
        ];

        populatePOIsOnMap(selectedMap);

        expect(global.allMapMarkers.length).toBe(0);
        expect(console.warn).toHaveBeenCalledTimes(3);
        expect(console.warn).toHaveBeenCalledWith('Invalid coordinates for POI: Bad Coords 1', [NaN, 50]);
    });

    it('should ignore POIs with out of bounds coordinates and log a warning', () => {
        const selectedMap = { width: 100, height: 100, name: 'Small Map' };
        global.visiblePointsCache = [
            { id: '6', name: 'Out of bounds 1', type: 'Settlement', coords: [-10, 50] },
            { id: '7', name: 'Out of bounds 2', type: 'Settlement', coords: [50, 150] }
        ];

        populatePOIsOnMap(selectedMap);

        expect(global.allMapMarkers.length).toBe(0);
        expect(console.warn).toHaveBeenCalledTimes(2);
        expect(console.warn).toHaveBeenCalledWith('POI coordinates out of bounds for map Small Map: Out of bounds 1', [-10, 50]);
    });

    it('should handle L.marker returning undefined gracefully and log a warning', () => {
        const selectedMap = { width: 100, height: 100, name: 'Test Map' };
        global.visiblePointsCache = [
            { id: '8', name: 'Undefined Marker POI', type: 'trigger-undefined', coords: [50, 50] }
        ];

        populatePOIsOnMap(selectedMap);

        expect(global.allMapMarkers.length).toBe(0);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith('L.marker returned undefined for POI: Undefined Marker POI');
    });

    it('should handle unexpected exceptions inside the loop, log error, and track analytics', () => {
        const selectedMap = { width: 100, height: 100, name: 'Error Map' };
        global.visiblePointsCache = [
            { id: '9', name: 'Error POI', type: 'trigger-error', coords: [50, 50] },
            { id: '10', name: 'Valid POI', type: 'Settlement', coords: [20, 20] } // Should still process subsequent POIs
        ];

        populatePOIsOnMap(selectedMap);

        expect(global.allMapMarkers.length).toBe(1); // The valid one should still be added
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith('Encountered 1 errors while processing POIs for map Error Map.');
        expect(global.trackAnalytics).toHaveBeenCalledWith('poi_processing_error', {
            poiName: 'Error POI',
            errorMessage: 'Simulated exception'
        });
    });
});
