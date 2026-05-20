const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function safeGetStorage(key) {');
const fnEnd = appSource.indexOf('function safeSetStorage(key, value) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate safeGetStorage function in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

let getItemMock;

// Mock localStorage globally
global.localStorage = {
    getItem: (key) => getItemMock(key)
};

// Evaluate the source
// eslint-disable-next-line no-eval
eval(fnSource);

console.log('localStorage mock setup ready.');

// Test 1: Successful retrieval
getItemMock = (key) => {
    if (key === 'validKey') return 'someValue';
    return null;
};
assert.equal(safeGetStorage('validKey'), 'someValue');
assert.equal(safeGetStorage('missingKey'), null);

// Test 2: localStorage.getItem throws error
getItemMock = (key) => {
    throw new Error('Access denied to localStorage');
};
assert.equal(safeGetStorage('anyKey'), null);

console.log('safeGetStorage checks passed');
