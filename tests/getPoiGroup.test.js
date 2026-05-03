const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionSource(name) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < appSource.length; i += 1) {
        const char = appSource[i];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }
    if (end === -1) {
        throw new Error(`Could not parse function ${name}`);
    }
    return appSource.slice(start, end);
}

const getPoiGroupSource = extractFunctionSource('getPoiGroup');

// Setup mock environment
global.typeToGroupMap = {
    'castle': 'Structures',
    'mountain': 'Natural Features',
    'village': 'Settlements'
};

global.poiGroupCache = new Map();

// Evaluate the function source code
// eslint-disable-next-line no-eval
eval(getPoiGroupSource);

// Test 1: Happy path - valid known type returns its group
assert.equal(getPoiGroup('castle'), 'Structures', 'Should return correct group for known type');

// Test 2: Data normalization - handles case-insensitivity and extra whitespace
assert.equal(getPoiGroup('  Mountain  '), 'Natural Features', 'Should handle uppercase and whitespace');
assert.equal(getPoiGroup('VILLAGE'), 'Settlements', 'Should handle all uppercase');

// Test 3: Unknown type - falls back and returns 'Unknown'
assert.equal(getPoiGroup('dragon'), 'Unknown', 'Should return Unknown for unmapped types');

// Test 4: Falsy values - empty strings, null, and undefined handle gracefully and return 'Unknown'
assert.equal(getPoiGroup(''), 'Unknown', 'Should return Unknown for empty string');
assert.equal(getPoiGroup('   '), 'Unknown', 'Should return Unknown for whitespace-only string');
assert.equal(getPoiGroup(null), 'Unknown', 'Should return Unknown for null');
assert.equal(getPoiGroup(undefined), 'Unknown', 'Should return Unknown for undefined');

console.log('getPoiGroup regression checks passed');
