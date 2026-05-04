const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

// Extract getVisibleRoutes using the existing project convention
const fnStart = appSource.indexOf('function getVisibleRoutes(mapObj) {');
const fnEnd = appSource.indexOf('function getVisibleEncounterTables(mapObj) {');
if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate getVisibleRoutes function in js/app.js');
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
assert.deepEqual(getVisibleRoutes({}), [], 'Should handle empty object gracefully');
assert.deepEqual(getVisibleRoutes({ routes: null }), [], 'Should handle null routes');
assert.deepEqual(getVisibleRoutes({ routes: 'not an array' }), [], 'Should handle non-array routes');

// 2. Filter out steps based on visibility
global.gmContentVisible = false;
const route1 = {
    id: 1,
    name: 'Route 1',
    steps: [
        { id: 's1', title: 'Step 1', visibility: 'public' },
        { id: 's2', title: 'Step 2', visibility: 'gm' }
    ]
};
assert.deepEqual(
    getVisibleRoutes({ routes: [route1] }),
    [{
        id: 1,
        name: 'Route 1',
        steps: [{ id: 's1', title: 'Step 1', visibility: 'public' }]
    }],
    'Should filter out gm steps when gmContentVisible is false'
);

// 3. Keep gm steps if gmContentVisible is true
global.gmContentVisible = true;
assert.deepEqual(
    getVisibleRoutes({ routes: [route1] }),
    [{
        id: 1,
        name: 'Route 1',
        steps: [
            { id: 's1', title: 'Step 1', visibility: 'public' },
            { id: 's2', title: 'Step 2', visibility: 'gm' }
        ]
    }],
    'Should keep gm steps when gmContentVisible is true'
);

// 4. Filter out whole route if all steps are filtered out
global.gmContentVisible = false;
const route2 = {
    id: 2,
    name: 'Route 2',
    steps: [
        { id: 's1', title: 'Step 1', visibility: 'gm' },
        { id: 's2', title: 'Step 2', visibility: 'gm' }
    ]
};
assert.deepEqual(
    getVisibleRoutes({ routes: [route2] }),
    [],
    'Should drop the entire route if no steps remain visible'
);

// 5. Filter out whole route if route visibility is restricted
global.gmContentVisible = false;
const route3 = {
    id: 3,
    name: 'Route 3',
    visibility: 'gm',
    steps: [
        { id: 's1', title: 'Step 1', visibility: 'public' }
    ]
};
assert.deepEqual(
    getVisibleRoutes({ routes: [route3] }),
    [],
    'Should drop the entire route if the route itself is not visible'
);

// 6. Handle missing or non-array steps
const route4 = {
    id: 4,
    name: 'Route 4',
    steps: null
};
const route5 = {
    id: 5,
    name: 'Route 5',
    steps: 'not an array'
};
assert.deepEqual(
    getVisibleRoutes({ routes: [route4, route5] }),
    [],
    'Should filter out routes with no valid steps array'
);

console.log('getVisibleRoutes tests passed');
