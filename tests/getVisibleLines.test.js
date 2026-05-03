const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

// Extract the getVisibleLines function
const fnStart = appSource.indexOf('function getVisibleLines(mapObj) {');
if (fnStart === -1) {
    throw new Error('Could not locate getVisibleLines function in js/app.js');
}

let braceCount = 0;
let fnEnd = -1;
for (let i = fnStart; i < appSource.length; i++) {
    if (appSource[i] === '{') {
        braceCount++;
    } else if (appSource[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
            fnEnd = i + 1;
            break;
        }
    }
}

if (fnEnd === -1) {
    throw new Error('Could not parse getVisibleLines function bounds in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

// Mock visibilityAllowed to act as a predictable filter
function visibilityAllowed(item) {
    return item.visibility !== 'gm';
}

// Evaluate the production helper directly.
// eslint-disable-next-line no-eval
eval(fnSource);

// Test 1: Empty map object
assert.deepEqual(getVisibleLines({}), []);

// Test 2: Map object with only roads (some hidden)
assert.deepEqual(
    getVisibleLines({
        roads: [
            { id: 1, visibility: 'public' },
            { id: 2, visibility: 'gm' },
            { id: 3 }
        ]
    }),
    [
        { id: 1, visibility: 'public' },
        { id: 3 }
    ]
);

// Test 3: Map object with only lines (some hidden)
assert.deepEqual(
    getVisibleLines({
        lines: [
            { id: 4, visibility: 'public' },
            { id: 5, visibility: 'gm' },
            { id: 6 }
        ]
    }),
    [
        { id: 4, visibility: 'public' },
        { id: 6 }
    ]
);

// Test 4: Map object with both roads and lines
assert.deepEqual(
    getVisibleLines({
        roads: [
            { id: 1, visibility: 'public' },
            { id: 2, visibility: 'gm' }
        ],
        lines: [
            { id: 3, visibility: 'public' },
            { id: 4, visibility: 'gm' }
        ]
    }),
    [
        { id: 1, visibility: 'public' },
        { id: 3, visibility: 'public' }
    ]
);

// Test 5: Map object with non-array roads and lines
assert.deepEqual(getVisibleLines({ roads: null, lines: 'invalid' }), []);

console.log('getVisibleLines tests passed');
