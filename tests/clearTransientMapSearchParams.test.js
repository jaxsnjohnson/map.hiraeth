const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const helperStart = appSource.indexOf('function clearTransientMapSearchParams(search = window.location.search) {');
const nextHelperStart = appSource.indexOf('function navigateToMap(mapId, { preResolvedMap = null, preserveSearch = false } = {}) {');

if (helperStart === -1 || nextHelperStart === -1 || nextHelperStart <= helperStart) {
    throw new Error('Could not locate clearTransientMapSearchParams in js/app.js');
}

const helperSource = appSource.slice(helperStart, nextHelperStart);

// eslint-disable-next-line no-eval
eval(helperSource);

assert.equal(
    clearTransientMapSearchParams('?view=1,2,3&poi=Old%20Dock&embed=true&mobileLayout=v2'),
    '?embed=true&mobileLayout=v2'
);

assert.equal(
    clearTransientMapSearchParams('?view=1,2,3&src=share&stype=view'),
    ''
);

assert.equal(
    clearTransientMapSearchParams('?hideUI=true'),
    '?hideUI=true'
);

console.log('clearTransientMapSearchParams regression checks passed');
