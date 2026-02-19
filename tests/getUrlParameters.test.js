const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function getUrlParameters() {');
const fnEnd = appSource.indexOf('// --- NEW: Format Custom Properties for Popups ---');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate getUrlParameters function in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);
// Evaluate the real function source to keep the test tightly coupled to production code.
// eslint-disable-next-line no-eval
eval(fnSource);

global.window = { location: { search: '?name=old%20lin&region=south' } };
assert.deepEqual(getUrlParameters(), { name: 'old lin', region: 'south' });

global.window = { location: { search: '?bad=%E0%A4%A' } };
assert.doesNotThrow(() => {
    const params = getUrlParameters();
    assert.equal(params.bad, '%E0%A4%A');
});

global.window = { location: { search: '?token=abc=def==&region=south' } };
assert.deepEqual(getUrlParameters(), { token: 'abc=def==', region: 'south' });

console.log('getUrlParameters regression checks passed');
