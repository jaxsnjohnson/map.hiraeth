const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const fnStart = appSource.indexOf('function setFilterCheckboxesChecked(checked) {');
const fnEnd = appSource.indexOf('if (poiFilterContainer) {', fnStart);
if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate setFilterCheckboxesChecked function in js/app.js');
}

let poiFilterCheckboxesLive = null;
let staticCheckboxes = [];
function getStaticPoiFilterCheckboxes() {
    return staticCheckboxes;
}

// eslint-disable-next-line no-eval
eval(appSource.slice(fnStart, fnEnd));

assert.doesNotThrow(() => setFilterCheckboxesChecked(true), 'Should no-op when filters are unavailable');

const masterToggle = { type: 'checkbox', id: 'filter-toggle-all', checked: false };
const poiFilter = { type: 'checkbox', id: 'filter-poi-city', checked: false };
const regionFilter = { type: 'checkbox', id: 'filter-region-forest', checked: false };
const textInput = { type: 'text', id: 'filter-search', checked: false };

staticCheckboxes = [masterToggle, poiFilter, regionFilter, textInput];
poiFilterCheckboxesLive = staticCheckboxes;

setFilterCheckboxesChecked(true);
assert.equal(masterToggle.checked, false, 'Should not update the master toggle');
assert.equal(poiFilter.checked, true, 'Should check POI filter checkboxes');
assert.equal(regionFilter.checked, true, 'Should check region filter checkboxes');
assert.equal(textInput.checked, false, 'Should not update non-checkbox inputs');

setFilterCheckboxesChecked(false);
assert.equal(masterToggle.checked, false, 'Should still leave the master toggle unchanged');
assert.equal(poiFilter.checked, false, 'Should uncheck POI filter checkboxes');
assert.equal(regionFilter.checked, false, 'Should uncheck region filter checkboxes');
assert.equal(textInput.checked, false, 'Should still leave non-checkbox inputs unchanged');

console.log('setFilterCheckboxesChecked tests passed');
