const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function safeSetJSON(key, value) {');
const fnEnd = appSource.indexOf('function normalizeMobileLayoutMode(rawValue) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate safeSetJSON function in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

let storedItems = {};
let shouldThrow = false;

// Mock localStorage globally
global.localStorage = {
    setItem: (key, value) => {
        if (shouldThrow) {
            throw new Error('Storage quota exceeded');
        }
        storedItems[key] = value;
    }
};

// Evaluate the source
// eslint-disable-next-line no-eval
eval(fnSource);

console.log('localStorage mock setup ready.');

// Test 1: Successful JSON stringify and setItem
storedItems = {};
safeSetJSON('validKey', { success: true, count: 42 });
assert.equal(storedItems['validKey'], '{"success":true,"count":42}');

// Test 2: Successful setItem with array
storedItems = {};
safeSetJSON('arrayKey', [1, 2, 3]);
assert.equal(storedItems['arrayKey'], '[1,2,3]');

// Test 3: Successful setItem with string
storedItems = {};
safeSetJSON('stringKey', 'hello');
assert.equal(storedItems['stringKey'], '"hello"');

// Test 4: Exception handling (e.g., quota exceeded)
shouldThrow = true;
// Should not throw an error, error is caught silently
safeSetJSON('validKey', { data: 1 });
shouldThrow = false; // reset flag
// Verify that the operation failed silently without setting
assert.equal(storedItems['validKey'], undefined);

// Test 5: Exception during JSON.stringify (circular reference)
const circularObj = {};
circularObj.self = circularObj;

// Should catch stringify error silently
safeSetJSON('circularKey', circularObj);
assert.equal(storedItems['circularKey'], undefined);

console.log('safeSetJSON regression checks passed');
