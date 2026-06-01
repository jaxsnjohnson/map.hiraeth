const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const helperStart = appSource.indexOf('function getRegionGroupChildCheckboxCounts(');
const helperEnd = appSource.indexOf('// --- Helper Function to Update the "Toggle All" Checkbox State ---', helperStart);

if (helperStart === -1 || helperEnd === -1 || helperEnd <= helperStart) {
    throw new Error('Could not locate getRegionGroupChildCheckboxCounts in js/app.js');
}

const helperSource = appSource.slice(helperStart, helperEnd);
let getRegionGroupChildCheckboxCounts;

// eslint-disable-next-line no-eval
eval(`getRegionGroupChildCheckboxCounts = ${helperSource}`);

function createRegionTypeCheckbox(groupName, checked) {
    return {
        checked,
        getAttribute(name) {
            return name === 'data-group' ? groupName : null;
        }
    };
}

const regionTypeCheckboxes = [
    createRegionTypeCheckbox('kingdoms', true),
    createRegionTypeCheckbox('kingdoms', false),
    createRegionTypeCheckbox('kingdoms', true),
    createRegionTypeCheckbox('wilds', false)
];

assert.deepEqual(
    getRegionGroupChildCheckboxCounts(regionTypeCheckboxes, 'kingdoms'),
    { childCount: 3, checkedChildCount: 2 }
);
assert.deepEqual(
    getRegionGroupChildCheckboxCounts(regionTypeCheckboxes, 'wilds'),
    { childCount: 1, checkedChildCount: 0 }
);
assert.deepEqual(
    getRegionGroupChildCheckboxCounts(regionTypeCheckboxes, 'missing'),
    { childCount: 0, checkedChildCount: 0 }
);

console.log('getRegionGroupChildCheckboxCounts regression checks passed');
