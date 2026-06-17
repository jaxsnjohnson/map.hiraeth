const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

// We need getRegionGroupChildCheckboxCounts since updateToggleAllCheckboxState calls it
const helper1Start = appSource.indexOf('function getRegionGroupChildCheckboxCounts(');
const helper1End = appSource.indexOf('// --- Helper Function to Update the "Toggle All" Checkbox State ---', helper1Start);
const helper1Source = appSource.slice(helper1Start, helper1End);

const helper2Start = appSource.indexOf('function updateToggleAllCheckboxState()');
const helper2End = appSource.indexOf('function setCoordsDisplayVisible', helper2Start);
const helper2Source = appSource.slice(helper2Start, helper2End);

if (helper2Start === -1 || helper2End === -1) {
    throw new Error('Could not locate updateToggleAllCheckboxState in js/app.js');
}

let getRegionGroupChildCheckboxCounts;
let updateToggleAllCheckboxState;

// Mocks
global.poiFilterCheckboxesLive = true;
let staticCheckboxes = [];
global.getStaticPoiFilterCheckboxes = () => staticCheckboxes;
global.filterToggleAllCheckbox = { checked: false, indeterminate: false };

// eslint-disable-next-line no-eval
eval(`getRegionGroupChildCheckboxCounts = ${helper1Source}`);
// eslint-disable-next-line no-eval
eval(`updateToggleAllCheckboxState = ${helper2Source}`);

// Helper to create checkbox mocks
function createCheckbox(type, classNames, checked, indeterminate = false, id = '', value = '', group = '') {
    return {
        type,
        id,
        value,
        checked,
        indeterminate,
        classList: {
            contains: (cls) => classNames.includes(cls)
        },
        getAttribute: (attr) => attr === 'data-group' ? group : null
    };
}

function runTest(checkboxes, expectedToggleChecked, expectedToggleIndeterminate, expectedGroupChecked = [], expectedGroupIndeterminate = []) {
    staticCheckboxes = checkboxes;
    global.filterToggleAllCheckbox = { checked: false, indeterminate: false };
    updateToggleAllCheckboxState();

    assert.equal(global.filterToggleAllCheckbox.checked, expectedToggleChecked, 'Toggle all checked state mismatch');
    assert.equal(global.filterToggleAllCheckbox.indeterminate, expectedToggleIndeterminate, 'Toggle all indeterminate state mismatch');

    // Check region group states
    const regionGroups = staticCheckboxes.filter(cb => cb.classList.contains('region-group-filter'));
    regionGroups.forEach((group, index) => {
        if (expectedGroupChecked[index] !== undefined) {
             assert.equal(group.checked, expectedGroupChecked[index], `Group ${index} checked mismatch`);
        }
        if (expectedGroupIndeterminate[index] !== undefined) {
             assert.equal(group.indeterminate, expectedGroupIndeterminate[index], `Group ${index} indeterminate mismatch`);
        }
    });
}

test('updateToggleAllCheckboxState: All checked', () => {
    runTest([
        createCheckbox('checkbox', ['poi-filter-checkbox'], true),
        createCheckbox('checkbox', ['line-type-filter'], true)
    ], true, false);
});

test('updateToggleAllCheckboxState: All unchecked', () => {
    runTest([
        createCheckbox('checkbox', ['poi-filter-checkbox'], false),
        createCheckbox('checkbox', ['line-type-filter'], false)
    ], false, false);
});

test('updateToggleAllCheckboxState: Mixed (indeterminate toggle)', () => {
    runTest([
        createCheckbox('checkbox', ['poi-filter-checkbox'], true),
        createCheckbox('checkbox', ['line-type-filter'], false)
    ], false, true);
});

test('updateToggleAllCheckboxState: Region Groups - All children checked -> Group checked, Toggle checked', () => {
    runTest([
        createCheckbox('checkbox', ['region-group-filter'], false, false, '', 'group1'),
        createCheckbox('checkbox', ['region-type-filter'], true, false, '', '', 'group1'),
        createCheckbox('checkbox', ['region-type-filter'], true, false, '', '', 'group1')
    ], true, false, [true], [false]);
});

test('updateToggleAllCheckboxState: Region Groups - Some children checked -> Group indeterminate, Toggle indeterminate', () => {
    runTest([
        createCheckbox('checkbox', ['region-group-filter'], false, false, '', 'group1'),
        createCheckbox('checkbox', ['region-type-filter'], true, false, '', '', 'group1'),
        createCheckbox('checkbox', ['region-type-filter'], false, false, '', '', 'group1')
    ], false, true, [false], [true]);
});

test('updateToggleAllCheckboxState: Region Groups - No children checked -> Group unchecked, Toggle unchecked', () => {
    runTest([
        createCheckbox('checkbox', ['region-group-filter'], true, true, '', 'group1'),
        createCheckbox('checkbox', ['region-type-filter'], false, false, '', '', 'group1'),
        createCheckbox('checkbox', ['region-type-filter'], false, false, '', '', 'group1')
    ], false, false, [false], [false]);
});

test('updateToggleAllCheckboxState: No top level filters -> Toggle checked', () => {
    runTest([
        createCheckbox('checkbox', ['region-type-filter'], true) // Doesn't count as top level
    ], true, false);
});

test('updateToggleAllCheckboxState: Skips filter-toggle-all', () => {
    runTest([
        createCheckbox('checkbox', ['poi-filter-checkbox'], false, false, 'filter-toggle-all'),
        createCheckbox('checkbox', ['poi-filter-checkbox'], true)
    ], true, false);
});

test('updateToggleAllCheckboxState: Exits early if !poiFilterCheckboxesLive', () => {
    global.poiFilterCheckboxesLive = false;
    staticCheckboxes = [
        createCheckbox('checkbox', ['poi-filter-checkbox'], false)
    ];
    global.filterToggleAllCheckbox = { checked: true, indeterminate: true };
    updateToggleAllCheckboxState();
    assert.equal(global.filterToggleAllCheckbox.checked, true, 'Should not have updated');
    assert.equal(global.filterToggleAllCheckbox.indeterminate, true, 'Should not have updated');
    global.poiFilterCheckboxesLive = true; // reset for other tests
});
