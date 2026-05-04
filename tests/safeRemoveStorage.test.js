const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function safeRemoveStorage(key) {');
const fnEnd = appSource.indexOf('function safeGetSessionStorage(key) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate safeRemoveStorage in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

let removedKeys = [];
let shouldThrow = false;

// Mock localStorage globally
global.localStorage = {
    removeItem: (key) => {
        if (shouldThrow) {
            throw new Error('Access denied to localStorage');
        }
        removedKeys.push(key);
    }
};

// Evaluate the source
// eslint-disable-next-line no-eval
eval(fnSource);

console.log('localStorage mock setup ready.');

// Test 1: Successful removal
removedKeys = [];
safeRemoveStorage('validKey');
assert.deepEqual(removedKeys, ['validKey']);

safeRemoveStorage('anotherKey');
assert.deepEqual(removedKeys, ['validKey', 'anotherKey']);

// Test 2: localStorage throws an error
shouldThrow = true;
try {
    safeRemoveStorage('errorKey');
    // Should not throw, and removedKeys shouldn't change
    assert.deepEqual(removedKeys, ['validKey', 'anotherKey']);
} catch (e) {
    assert.fail('safeRemoveStorage should swallow exceptions from localStorage.removeItem');
}

console.log('safeRemoveStorage checks passed');
