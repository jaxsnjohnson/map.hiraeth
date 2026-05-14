const fs = require('fs');
const assert = require('node:assert/strict');

// Extract source code using memory pattern
const code = fs.readFileSync('js/app.js', 'utf-8');

// Global mock dependencies
global.SEARCH_RESULT_GROUP_ORDER = ['poi', 'region', 'line', 'route', 'step', 'map'];
global.SEARCH_RESULT_GROUP_INDEX = Object.create(null);
global.SEARCH_RESULT_GROUP_ORDER.forEach((group, index) => {
    global.SEARCH_RESULT_GROUP_INDEX[group] = index;
});

const functionStart = code.indexOf('function sortSearchResults(results)');
const functionEnd = code.indexOf('function computePrecomputedSearchMatch', functionStart);

if (functionStart === -1 || functionEnd === -1) {
    throw new Error('Could not extract sortSearchResults function block');
}

const functionCode = code.substring(functionStart, functionEnd);
eval(functionCode);

// Test Cases
const results = [
    { score: 10, group: 'poi', title: 'C POI' },
    { score: 10, group: 'region', title: 'A Region' },
    { score: 5, group: 'map', title: 'A Map' },
    { score: 10, group: 'poi', title: 'A POI' },
    { score: 10, group: 'unknown', title: 'Unknown Group' }
];

const sorted = sortSearchResults(results);

// Expect:
// 1. score 10 before score 5
// 2. group 'poi' (index 0) before 'region' (index 1)
// 3. 'unknown' group fallback to index -1, so it comes before 'poi' (0)
// 4. Alphabetical tie breaker for 'A POI' and 'C POI'
assert.equal(sorted.length, 5);
assert.equal(sorted[0].title, 'Unknown Group', 'Unknown group should fall back to index -1');
assert.equal(sorted[1].title, 'A POI', 'A POI should come first among POIs due to alphabetical sorting');
assert.equal(sorted[2].title, 'C POI', 'C POI should come next');
assert.equal(sorted[3].title, 'A Region', 'A Region comes after POI (index 1 vs 0)');
assert.equal(sorted[4].title, 'A Map', 'A Map comes last because its score is 5');

console.log('sortSearchResults tests passed');
