const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

// Extract stripHtml
const stripHtmlStart = appSource.indexOf('function stripHtml(value) {');
const stripHtmlEnd = appSource.indexOf('function getMapRuntimeData(mapId = currentlyLoadedMapId) {');

// Extract getMobileMapSummaryExcerpt
const getMobileMapSummaryExcerptStart = appSource.indexOf('function getMobileMapSummaryExcerpt(mapInfo, maxLength = 148) {');
const getMobileMapSummaryExcerptEnd = appSource.indexOf('\nfunction closeSearchResults(', getMobileMapSummaryExcerptStart);

if (stripHtmlStart === -1 || stripHtmlEnd === -1 || getMobileMapSummaryExcerptStart === -1 || getMobileMapSummaryExcerptEnd === -1) {
    throw new Error('Could not locate required functions in js/app.js');
}

const stripHtmlSource = appSource.slice(stripHtmlStart, stripHtmlEnd);
const getMobileMapSummaryExcerptSource = appSource.slice(getMobileMapSummaryExcerptStart, getMobileMapSummaryExcerptEnd);

// eslint-disable-next-line no-eval
eval(stripHtmlSource);
// eslint-disable-next-line no-eval
eval(getMobileMapSummaryExcerptSource);

// Test 1: No blurb or undefined mapInfo
assert.equal(
    getMobileMapSummaryExcerpt({}),
    'Search locations and regions on this map.',
    'Should return default string for empty mapInfo'
);

assert.equal(
    getMobileMapSummaryExcerpt({ blurb: '' }),
    'Search locations and regions on this map.',
    'Should return default string for empty blurb'
);

assert.equal(
    getMobileMapSummaryExcerpt(null),
    'Search locations and regions on this map.',
    'Should return default string for null mapInfo'
);

// Test 2: Short blurb without HTML
assert.equal(
    getMobileMapSummaryExcerpt({ blurb: 'A short blurb.' }),
    'A short blurb.',
    'Should return original text if short'
);

// Test 3: Short blurb with HTML
assert.equal(
    getMobileMapSummaryExcerpt({ blurb: '<p>A short blurb.</p>' }),
    'A short blurb.',
    'Should strip HTML even if short'
);

// Test 4: Long blurb (truncation without HTML)
assert.equal(
    getMobileMapSummaryExcerpt({ blurb: 'This is a somewhat long blurb that needs to be truncated to exactly thirty characters.' }, 30),
    'This is a somewhat long…',
    'Should truncate to length - 1 and append ellipsis at last full word'
);

// Test 5: Long blurb with HTML
assert.equal(
    getMobileMapSummaryExcerpt({ blurb: '<p>This is a somewhat long blurb that needs to be truncated to exactly thirty characters.</p>' }, 30),
    'This is a somewhat long…',
    'Should strip HTML then truncate to length - 1 and append ellipsis at last full word'
);

// Test 6: Long blurb truncating at whitespace
assert.equal(
    getMobileMapSummaryExcerpt({ blurb: 'This is a test to truncate at space' }, 19),
    'This is a test to…',
    'Should trim trailing space before appending ellipsis'
);

// Test 7: Word longer than the excerpt length
assert.equal(
    getMobileMapSummaryExcerpt({ blurb: 'Supercalifragilisticexpialidocious is long' }, 20),
    'Supercalifragilisti…',
    'Fallback to cutting mid-word if no space found'
);

console.log('getMobileMapSummaryExcerpt tests passed');
