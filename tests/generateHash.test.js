const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function generateHash(mapId, sidebarState) {');
const fnEnd = appSource.indexOf('function buildAppUrlWithHash(hash, search = window.location.search) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate generateHash function in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);
// Evaluate the production helper directly.
// eslint-disable-next-line no-eval
eval(fnSource);

assert.equal(generateHash('my-map', 'o'), '#my-map-s=o');
assert.equal(generateHash('my-map', 'c'), '#my-map-s=c');
assert.equal(generateHash('my-map', 'invalid'), '#my-map-s=o');
assert.equal(generateHash('my-map', null), '#my-map-s=o');
assert.equal(generateHash('', 'o'), '#-s=o');
assert.equal(generateHash(null, 'c'), '#-s=c');
assert.equal(generateHash(undefined, 'o'), '#-s=o');
assert.equal(generateHash('  spaced-map  ', 'c'), '#spaced-map-s=c');

console.log('generateHash regression checks passed');
