const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const startMarker = 'function setElementHiddenState(element, hidden) {';
const endMarker = 'function createMobilePlacementAnchor(element) {';

const start = appSource.indexOf(startMarker);
const end = appSource.indexOf(endMarker, start);

if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate setElementHiddenState in js/app.js');
}

const snippet = appSource.slice(start, end);

// eslint-disable-next-line no-eval
eval(snippet);

// Happy path
const el1 = { hidden: false };
setElementHiddenState(el1, true);
assert.equal(el1.hidden, true, 'element hidden should be true');

const el2 = { hidden: true };
setElementHiddenState(el2, false);
assert.equal(el2.hidden, false, 'element hidden should be false');

// Truthy/Falsy values
const el3 = { hidden: false };
setElementHiddenState(el3, 1);
assert.equal(el3.hidden, true, 'element hidden should be coerced to true');

const el4 = { hidden: true };
setElementHiddenState(el4, 0);
assert.equal(el4.hidden, false, 'element hidden should be coerced to false');

const el5 = { hidden: false };
setElementHiddenState(el5, 'hidden');
assert.equal(el5.hidden, true, 'element hidden should be coerced to true');

const el6 = { hidden: true };
setElementHiddenState(el6, '');
assert.equal(el6.hidden, false, 'element hidden should be coerced to false');

const el7 = { hidden: true };
setElementHiddenState(el7, null);
assert.equal(el7.hidden, false, 'element hidden should be coerced to false');

const el8 = { hidden: true };
setElementHiddenState(el8, undefined);
assert.equal(el8.hidden, false, 'element hidden should be coerced to false');

// Edge cases
// Should not throw when element is null or undefined
assert.doesNotThrow(() => {
    setElementHiddenState(null, true);
}, 'should not throw when element is null');

assert.doesNotThrow(() => {
    setElementHiddenState(undefined, true);
}, 'should not throw when element is undefined');

console.log('setElementHiddenState regression checks passed');
