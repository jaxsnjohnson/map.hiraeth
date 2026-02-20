const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function getHistoryStateValue(state, key, fallbackValue) {');
const fnEnd = appSource.indexOf('function generateHash(mapId, sidebarState) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate getHistoryStateValue function in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);
// Evaluate the production helper directly.
// eslint-disable-next-line no-eval
eval(fnSource);

assert.equal(getHistoryStateValue({ mapId: null }, 'mapId', 'hash-map'), null);
assert.equal(getHistoryStateValue({ mapId: '' }, 'mapId', 'hash-map'), '');
assert.equal(getHistoryStateValue({ mapId: 'current-map' }, 'mapId', 'hash-map'), 'current-map');
assert.equal(getHistoryStateValue({}, 'mapId', 'hash-map'), 'hash-map');
assert.equal(getHistoryStateValue(null, 'mapId', 'hash-map'), 'hash-map');
assert.equal(getHistoryStateValue({ sidebarState: 'c' }, 'sidebarState', 'o'), 'c');

console.log('getHistoryStateValue regression checks passed');
