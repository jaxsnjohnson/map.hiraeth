const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function getUrlParameters() {');
const fnEnd = appSource.indexOf('// --- NEW: Format Custom Properties for Popups ---');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate embed URL helpers in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);
// Evaluate the real helper sources to keep this test coupled to production behavior.
// eslint-disable-next-line no-eval
eval(fnSource);

global.window = { location: { search: '?embed=true' } };
assert.equal(isEmbedModeFromUrl(), true);

global.window = { location: { search: '?hideUI=true' } };
assert.equal(isEmbedModeFromUrl(), true);

global.window = { location: { search: '?embed=false&hideUI=false' } };
assert.equal(isEmbedModeFromUrl(), false);

global.window = { location: { search: '?foo=bar&embed=%E0%A4%A' } };
assert.equal(isEmbedModeFromUrl(), false);

global.window = { location: { search: '?foo=bar' } };
assert.equal(isEmbedModeFromUrl(), false);

console.log('isEmbedModeFromUrl regression checks passed');
