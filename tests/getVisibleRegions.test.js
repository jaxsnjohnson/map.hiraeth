const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const fnStart = appSource.indexOf('function getVisibleRegions(mapObj) {');
const fnEnd = appSource.indexOf('function getVisibleLines(mapObj) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate getVisibleRegions function block in js/app.js');
}
const getVisibleRegionsSrc = appSource.slice(fnStart, fnEnd);

const visStart = appSource.indexOf('function visibilityAllowed(item) {');
const visEnd = appSource.indexOf('function trackAnalytics(eventName, details = {}) {');

if (visStart === -1 || visEnd === -1 || visEnd <= visStart) {
    throw new Error('Could not locate visibilityAllowed function block in js/app.js');
}
const visibilityAllowedSrc = appSource.slice(visStart, visEnd);

// Mock global variable used by visibilityAllowed
let gmContentVisible = false;

// eslint-disable-next-line no-eval
eval(visibilityAllowedSrc);
// eslint-disable-next-line no-eval
eval(getVisibleRegionsSrc);

// 1. Happy path: Array with mixed visibility
const mapObj = {
    regions: [
        { id: 'public-region', visibility: 'public' },
        { id: 'gm-region', visibility: 'gm' },
        { id: 'default-region' } // missing visibility defaults to public
    ]
};

// Test when GM content is hidden
gmContentVisible = false;
let visible = getVisibleRegions(mapObj);
assert.equal(visible.length, 2);
assert.equal(visible[0].id, 'public-region');
assert.equal(visible[1].id, 'default-region');

// Test when GM content is visible
gmContentVisible = true;
visible = getVisibleRegions(mapObj);
assert.equal(visible.length, 3);
assert.equal(visible[1].id, 'gm-region');

// 2. Edge case: missing regions array
assert.deepEqual(getVisibleRegions({}), []);

// 3. Edge case: regions is not an array
assert.deepEqual(getVisibleRegions({ regions: "not an array" }), []);

console.log('getVisibleRegions tests passed');
