const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

// Extract setSearchScope function
const fnStart = appSource.indexOf('function setSearchScope(scope) {');
const fnEnd = appSource.indexOf('function getMobileMapSummaryExcerpt(mapInfo, maxLength = 148) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate setSearchScope function in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

// Setup globals needed for the test
global.SEARCH_SCOPE_ATLAS = 'atlas';
global.SEARCH_SCOPE_MAP = 'map';

global.currentSearchScope = null;
global.searchScopeAtlasBtn = null;

// Mock resolveSearchScope
global.resolveSearchScope = (scope) => {
    return scope === 'atlas' ? 'atlas' : 'map';
};

// eslint-disable-next-line no-eval
eval(fnSource);

// --- Tests --- //

// Test 1: Button is null
global.searchScopeAtlasBtn = null;
global.currentSearchScope = null;
assert.doesNotThrow(() => setSearchScope('atlas'));
assert.equal(global.currentSearchScope, 'atlas');

// Test 2: Button exists, scope is atlas (active)
let ariaPressedValue = null;
global.searchScopeAtlasBtn = {
    setAttribute: (attr, value) => {
        if (attr === 'aria-pressed') {
            ariaPressedValue = value;
        }
    }
};

global.currentSearchScope = null;
ariaPressedValue = null;
setSearchScope('atlas');
assert.equal(global.currentSearchScope, 'atlas');
assert.equal(ariaPressedValue, 'true');

// Test 3: Button exists, scope is map (inactive)
global.currentSearchScope = null;
ariaPressedValue = null;
setSearchScope('map');
assert.equal(global.currentSearchScope, 'map');
assert.equal(ariaPressedValue, 'false');

console.log('setSearchScope tests passed');
