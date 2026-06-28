const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionRange(startMarker, endMarker) {
    const start = appSource.indexOf(startMarker);
    if (start === -1) {
        throw new Error(`Could not find start marker: ${startMarker}`);
    }
    const end = endMarker ? appSource.indexOf(endMarker, start) : appSource.length;
    if (end === -1) {
        throw new Error(`Could not find end marker: ${endMarker}`);
    }
    return appSource.slice(start, end);
}

const snippets = [
    extractFunctionRange('function stripHtml(', 'function getMapRuntimeData('),
    extractFunctionRange('function resolveSearchScope(', 'mobileLayoutV2Enabled = resolveMobileLayoutV2Enabled();'),
    extractFunctionRange('function setSearchScope(', 'function closeSearchResults('),
    extractFunctionRange('function getMobileMapSummaryExcerpt(', 'function closeSearchResults(')
].join('\n');

global.SEARCH_SCOPE_MAP = 'map';
global.SEARCH_SCOPE_ATLAS = 'atlas';
global.currentSearchScope = global.SEARCH_SCOPE_MAP;
global.isMobileLayoutActive = false;
global.searchScopeAtlasBtn = {
    pressed: null,
    setAttribute(name, value) {
        if (name === 'aria-pressed') this.pressed = value;
    }
};

// eslint-disable-next-line no-eval
eval(snippets);

assert.equal(resolveSearchScope('atlas', { isMobileLayout: true }), 'atlas');
assert.equal(resolveSearchScope('map', { isMobileLayout: true }), 'map');
assert.equal(resolveSearchScope('atlas', { isMobileLayout: false }), 'atlas');

global.isMobileLayoutActive = true;
setSearchScope('atlas');
assert.equal(global.currentSearchScope, 'atlas');
assert.equal(global.searchScopeAtlasBtn.pressed, 'true');

global.isMobileLayoutActive = false;
setSearchScope('atlas');
assert.equal(global.currentSearchScope, 'atlas');
assert.equal(global.searchScopeAtlasBtn.pressed, 'true');

assert.equal(
    getMobileMapSummaryExcerpt({ blurb: '<p>Fog rolls over the harbor while old bells ring at dusk.</p>' }, 80),
    'Fog rolls over the harbor while old bells ring at dusk.'
);
assert.equal(
    getMobileMapSummaryExcerpt({ blurb: '' }),
    'Search locations and regions on this map.'
);
assert.match(
    getMobileMapSummaryExcerpt({ blurb: '<p>This is a deliberately long blurb used to verify truncation happens cleanly without leaving dangling partial words behind in the mobile explore summary.</p>' }, 72),
    /…$/
);

console.log('mobile explore context regression checks passed');
