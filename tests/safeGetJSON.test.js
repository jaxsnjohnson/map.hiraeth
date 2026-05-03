const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function safeGetStorage(key) {');
const fnEnd = appSource.indexOf('function safeSetJSON(key, value) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate safeGetStorage and safeGetJSON functions in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

let getItemMock;

// Mock localStorage globally
global.localStorage = {
    getItem: (key) => getItemMock(key)
};

// Mock sessionStorage just in case (as it's extracted too)
global.sessionStorage = {
    getItem: () => null,
    setItem: () => {}
};

// Evaluate the source
// eslint-disable-next-line no-eval
eval(fnSource);

console.log('localStorage mock setup ready.');

// Test 1: Successful JSON parse
getItemMock = (key) => {
    if (key === 'validKey') return '{"success": true, "count": 42}';
    return null;
};
assert.deepEqual(safeGetJSON('validKey'), { success: true, count: 42 });

// Test 2: localStorage returns null (should return fallback)
assert.equal(safeGetJSON('missingKey', 'defaultVal'), 'defaultVal');

// Test 3: localStorage returns invalid JSON (should return fallback)
getItemMock = (key) => {
    if (key === 'invalidKey') return '{bad-json}';
    return null;
};
assert.equal(safeGetJSON('invalidKey', 'defaultVal'), 'defaultVal');

// Test 4: safeGetStorage returns empty string (should return fallback)
getItemMock = (key) => {
    if (key === 'emptyKey') return '';
    return null;
};
assert.equal(safeGetJSON('emptyKey', 'defaultVal'), 'defaultVal');

// Test 5: localStorage.getItem throws error (e.g. private mode or storage disabled)
getItemMock = (key) => {
    throw new Error('Access denied to localStorage');
};
assert.equal(safeGetJSON('anyKey', { fallbackObj: true }).fallbackObj, true);

// Test 6: safeGetJSON with no fallback specified (default fallback is null)
getItemMock = (key) => {
    if (key === 'invalidKey2') return '{bad-json}';
    return null;
};
assert.equal(safeGetJSON('invalidKey2'), null);

console.log('safeGetJSON regression checks passed');
