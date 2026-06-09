const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const fnStart = appSource.indexOf('function getMapRuntimeData(');
const fnEnd = appSource.indexOf('function getMapDataUrl(');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate getMapRuntimeData function block in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

// Setup global mock variables
global.currentlyLoadedMapId = null;
global.currentMapData = null;
global.mapData = [];
global.findMapRecursiveCalled = false;

// Setup mock function
global.findMapRecursive = function(items, id) {
    global.findMapRecursiveCalled = true;
    if (id === 'recursive-id') {
        return { id: 'recursive-id', val: 'found' };
    }
    return null;
};

// Evaluate the function source code
// eslint-disable-next-line no-eval
eval(fnSource);

// --- Test Cases ---

// Test 1: Fallback to currentlyLoadedMapId when no argument is passed (and it is falsy)
global.currentlyLoadedMapId = null;
assert.equal(getMapRuntimeData(), null);

// Test 2: Fallback to currentlyLoadedMapId when no argument is passed (and it is valid)
global.currentlyLoadedMapId = 'recursive-id';
global.currentMapData = null;
global.findMapRecursiveCalled = false;
assert.deepEqual(getMapRuntimeData(), { id: 'recursive-id', val: 'found' });
assert.equal(global.findMapRecursiveCalled, true);

// Test 3: Returning currentMapData directly (verifying caching/fast-path)
global.findMapRecursiveCalled = false;
global.currentlyLoadedMapId = 'map-1'; // This shouldn't be used since we pass mapId
global.currentMapData = { id: 'map-2', val: 'cached' };
assert.deepEqual(getMapRuntimeData('map-2'), { id: 'map-2', val: 'cached' });
assert.equal(global.findMapRecursiveCalled, false);

// Test 4: Falling back to findMapRecursive when mapId doesn't match currentMapData.id
global.findMapRecursiveCalled = false;
global.currentMapData = { id: 'map-2', val: 'cached' };
assert.deepEqual(getMapRuntimeData('recursive-id'), { id: 'recursive-id', val: 'found' });
assert.equal(global.findMapRecursiveCalled, true);

// Test 5: Returning null when findMapRecursive returns null
global.findMapRecursiveCalled = false;
assert.equal(getMapRuntimeData('missing-id'), null);
assert.equal(global.findMapRecursiveCalled, true);

console.log('getMapRuntimeData tests passed');
