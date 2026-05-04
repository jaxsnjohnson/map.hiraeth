const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

// Extract getVisiblePoints using the existing project convention: slicing up to the next function declaration
const fnStart = appSource.indexOf('function getVisiblePoints(mapObj) {');
const fnEnd = appSource.indexOf('function getVisibleRegions(mapObj) {');
if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate getVisiblePoints function in js/app.js');
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
assert.deepEqual(getVisiblePoints({}), [], 'Should handle empty object gracefully');
assert.deepEqual(getVisiblePoints({ pointsOfInterest: null, points: undefined }), [], 'Should handle null/undefined points properties');
assert.deepEqual(getVisiblePoints({ pointsOfInterest: 'string', points: 123 }), [], 'Should handle non-array points properties');

// 2. Precedence (pointsOfInterest vs points)
const mapObj1 = {
    pointsOfInterest: [{ id: 1, name: 'POI 1' }],
    points: [{ id: 2, name: 'Point 1' }]
};
assert.deepEqual(getVisiblePoints(mapObj1), [
    { id: 1, name: 'POI 1' }
], 'Should prefer pointsOfInterest over points if it is an array');

const mapObj2 = {
    pointsOfInterest: 'not an array',
    points: [{ id: 2, name: 'Point 1' }]
};
assert.deepEqual(getVisiblePoints(mapObj2), [
    { id: 2, name: 'Point 1' }
], 'Should fall back to points if pointsOfInterest is not an array');

// 3. Visibility filtering (gmContentVisible = false)
global.gmContentVisible = false;
const mapObj3 = {
    points: [
        { id: 1, name: 'Public Point', visibility: 'public' },
        { id: 2, name: 'GM Point', visibility: 'gm' },
        { id: 3, name: 'No Visibility Point' }, // Defaults to public
        { id: 4, name: 'GM Case-insensitive', visibility: 'GM' }
    ]
};
assert.deepEqual(getVisiblePoints(mapObj3), [
    { id: 1, name: 'Public Point', visibility: 'public' },
    { id: 3, name: 'No Visibility Point' }
], 'Should filter out GM points when gmContentVisible is false');

// 4. Visibility filtering (gmContentVisible = true)
global.gmContentVisible = true;
assert.deepEqual(getVisiblePoints(mapObj3), [
    { id: 1, name: 'Public Point', visibility: 'public' },
    { id: 2, name: 'GM Point', visibility: 'gm' },
    { id: 3, name: 'No Visibility Point' },
    { id: 4, name: 'GM Case-insensitive', visibility: 'GM' }
], 'Should include GM points when gmContentVisible is true');

console.log('getVisiblePoints tests passed');
