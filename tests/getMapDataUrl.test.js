const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function getMapDataUrl(mapEntry) {');
const fnEnd = appSource.indexOf('async function getMapDefinition(mapId, preResolvedMap = null) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate getMapDataUrl function block in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);
// Evaluate production source so assertions stay coupled to real logic.
// eslint-disable-next-line no-eval
eval(fnSource);

// Test explicit dataUrl
assert.equal(getMapDataUrl({ dataUrl: 'custom/path.json' }), 'custom/path.json');

// Test explicit dataUrl with whitespace (should fallback to id if empty after trim)
assert.equal(getMapDataUrl({ dataUrl: '   ', id: 'fallback-id' }), 'maps/fallback-id.json');
assert.equal(getMapDataUrl({ dataUrl: '  custom/path.json  ' }), 'custom/path.json');

// Test no dataUrl, valid id
assert.equal(getMapDataUrl({ id: 'my-map-id' }), 'maps/my-map-id.json');

// Test id with whitespace
assert.equal(getMapDataUrl({ id: '  my-map-id  ' }), 'maps/my-map-id.json');

// Test no dataUrl, empty id
assert.equal(getMapDataUrl({ id: '' }), '');
assert.equal(getMapDataUrl({ id: '   ' }), '');

// Test completely empty object
assert.equal(getMapDataUrl({}), '');

// Test null/undefined
assert.equal(getMapDataUrl(null), '');
assert.equal(getMapDataUrl(undefined), '');

console.log('getMapDataUrl regression checks passed');
