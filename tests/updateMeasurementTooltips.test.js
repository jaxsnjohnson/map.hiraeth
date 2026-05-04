const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const funcStart = appSource.indexOf('function updateMeasurementTooltips() {');
const funcEnd = appSource.indexOf('function finalizeMultiPointMeasure(');

if (funcStart === -1 || funcEnd === -1 || funcEnd <= funcStart) {
    throw new Error('Could not locate updateMeasurementTooltips in js/app.js');
}

const funcSource = appSource.slice(funcStart, funcEnd);

// Mock global variables to satisfy both the actual code's requirements
// and the expected legacy conditions from the issue description.
global.currentlyLoadedMapId = null;
global.multiPointPath = [];
global.multiPointTotalTooltip = null;

// The issue description mentions these variables for the early return condition:
// `if (!isMeasuring || !measurementPath) return;`
// We mock them here to ensure no ReferenceErrors occur if the environment expects them,
// and to test the early return logic.
global.isMeasuring = false;
global.measurementPath = null;
global.measurementTooltips = [];

global.map = {
    removedLayers: [],
    removeLayer: function(layer) {
        this.removedLayers.push(layer);
    }
};

let getMapRuntimeDataCalled = false;
global.getMapRuntimeData = function(id) {
    getMapRuntimeDataCalled = true;
    return null;
};

// Evaluate the function
// eslint-disable-next-line no-eval
eval(funcSource);

// --- Test Case 1: Early Return Triggered (Not Measuring) ---
// Simulates `!isMeasuring` and `!currentlyLoadedMapId` being falsey
global.isMeasuring = false;
global.currentlyLoadedMapId = null;
global.measurementPath = [{lat: 0, lng: 0}];
global.multiPointPath = [{lat: 0, lng: 0}];
global.measurementTooltips = [{ id: 'tt1' }];
global.multiPointTotalTooltip = { id: 'old-tooltip' };
global.map.removedLayers = [];
getMapRuntimeDataCalled = false;

updateMeasurementTooltips();

// Assert early return prevented cleanup of the array
assert.equal(global.measurementTooltips.length, 1, 'measurementTooltips should not be cleared during early return');
assert.equal(getMapRuntimeDataCalled, false, 'Should return early before getMapRuntimeData is called');

// --- Test Case 2: Early Return Triggered (No Path Exists) ---
// Simulates `!measurementPath` and empty `multiPointPath`
global.isMeasuring = true;
global.currentlyLoadedMapId = 'map-1';
global.measurementPath = null;
global.multiPointPath = [];
global.measurementTooltips = [{ id: 'tt1' }];
global.multiPointTotalTooltip = { id: 'old-tooltip-2' };
global.map.removedLayers = [];
getMapRuntimeDataCalled = false;

updateMeasurementTooltips();

// Assert early return prevented cleanup of the array
assert.equal(global.measurementTooltips.length, 1, 'measurementTooltips should not be cleared during early return');
assert.equal(getMapRuntimeDataCalled, false, 'Should return early before getMapRuntimeData is called');

// --- Test Case 3: Condition passes, does NOT early return ---
// Simulates `isMeasuring` true and `measurementPath` exists
global.isMeasuring = true;
global.currentlyLoadedMapId = 'map-1';
global.measurementPath = [{lat: 0, lng: 0}, {lat: 1, lng: 1}];
global.multiPointPath = [{lat: 0, lng: 0}, {lat: 1, lng: 1}];
global.measurementTooltips = [{ id: 'tt1' }];
global.multiPointTotalTooltip = { id: 'old-tooltip-3' };
global.map.removedLayers = [];
getMapRuntimeDataCalled = false;

try {
    updateMeasurementTooltips();
} catch (e) {
    // Expected to throw an error since we haven't mocked L.tooltip, etc.
}

assert.equal(getMapRuntimeDataCalled, true, 'Should NOT return early, function should proceed');

console.log('updateMeasurementTooltips early return checks passed');
