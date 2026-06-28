const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

// Extract getVisibleLines using the existing project convention: slicing up to the next function declaration
const fnStart = appSource.indexOf('function getVisibleLines(mapObj) {');
const fnEnd = appSource.indexOf('function getVisibleEncounterTables(mapObj) {');
if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate getVisibleLines function in js/app.js');
}
const fnSource = appSource.slice(fnStart, fnEnd);

// Extract visibilityAllowed using the same robust slicing technique
const visStart = appSource.indexOf('function visibilityAllowed(item) {');
const visEnd = appSource.indexOf('function trackAnalytics(eventName, details = {}) {');
if (visStart === -1 || visEnd === -1 || visEnd <= visStart) {
    throw new Error('Could not locate visibilityAllowed function in js/app.js');
}
const visSource = appSource.slice(visStart, visEnd);

// Mock global variable used by visibilityAllowed
global.gmContentVisible = false;

// Evaluate functions into the current scope
// eslint-disable-next-line no-eval
eval(visSource);
// eslint-disable-next-line no-eval
eval(fnSource);

// --- Test Cases ---

// 1. Handle missing/empty arrays
assert.deepEqual(getVisibleLines({}), [], 'Should handle empty object gracefully');
assert.deepEqual(getVisibleLines({ roads: null, lines: undefined }), [], 'Should handle null/undefined roads and lines');

// 2. Concatenation and filtering (no visibility restrictions)
const mapObj1 = {
    roads: [{ id: 1, name: 'Road 1' }],
    lines: [{ id: 2, name: 'Line 1' }]
};
assert.deepEqual(getVisibleLines(mapObj1), [
    { id: 1, name: 'Road 1' },
    { id: 2, name: 'Line 1' }
], 'Should concatenate roads and lines');

// 3. Visibility filtering (gmContentVisible = false)
global.gmContentVisible = false;
const mapObj2 = {
    roads: [
        { id: 1, name: 'Public Road', visibility: 'public' },
        { id: 2, name: 'GM Road', visibility: 'gm' }
    ],
    lines: [
        { id: 3, name: 'No Visibility Line' }, // Defaults to public
        { id: 4, name: 'GM Line', visibility: 'GM' } // Case-insensitive
    ]
};
assert.deepEqual(getVisibleLines(mapObj2), [
    { id: 1, name: 'Public Road', visibility: 'public' },
    { id: 3, name: 'No Visibility Line' }
], 'Should filter out GM lines when gmContentVisible is false');

// 4. Visibility filtering (gmContentVisible = true)
global.gmContentVisible = true;
assert.deepEqual(getVisibleLines(mapObj2), [
    { id: 1, name: 'Public Road', visibility: 'public' },
    { id: 2, name: 'GM Road', visibility: 'gm' },
    { id: 3, name: 'No Visibility Line' },
    { id: 4, name: 'GM Line', visibility: 'GM' }
], 'Should include GM lines when gmContentVisible is true');

// 5. Array type validation (one is array, one is not)
const mapObj3 = {
    roads: [{ id: 1 }],
    lines: 'not an array'
};
assert.deepEqual(getVisibleLines(mapObj3), [{ id: 1 }], 'Should handle non-array lines correctly');

const mapObj4 = {
    roads: 123,
    lines: [{ id: 2 }]
};
assert.deepEqual(getVisibleLines(mapObj4), [{ id: 2 }], 'Should handle non-array roads correctly');

console.log('getVisibleLines tests passed');
