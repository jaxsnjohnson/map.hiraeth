const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function updateTravelTime(');
const fnEnd = appSource.indexOf('function populateFilters(');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate updateTravelTime function in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

global.travelDistanceInput = { value: '' };
global.travelModeSelect = { value: '' };
global.travelTimeOutput = { textContent: '' };
global.lastMeasuredDistanceKm = 0;

// eslint-disable-next-line no-eval
eval(fnSource);

// test 1: All inputs undefined/null
global.travelDistanceInput = null;
assert.doesNotThrow(() => updateTravelTime());

// Reset
global.travelDistanceInput = { value: '' };

// test 2: Missing distance
updateTravelTime();
assert.equal(global.travelTimeOutput.textContent, 'Enter distance to compute time.');

// test 3: compute time
global.travelDistanceInput = { value: '10' };
global.travelModeSelect = { value: '5' };
updateTravelTime();
assert.equal(global.travelTimeOutput.textContent, '2.0 hours (~0.08 days)');

// test 4: using lastMeasuredDistanceKm
global.travelDistanceInput = { value: '' };
global.lastMeasuredDistanceKm = 24;
global.travelModeSelect = { value: '4' };
updateTravelTime();
assert.equal(global.travelTimeOutput.textContent, '6.0 hours (~0.25 days)');

console.log('updateTravelTime regression checks passed');
