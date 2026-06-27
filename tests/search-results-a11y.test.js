const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');

assert.match(
    indexSource,
    /id="poi-search-input"[^>]*role="combobox"[^>]*aria-autocomplete="list"[^>]*aria-controls="search-results-container"[^>]*aria-expanded="false"/,
    'Search input should expose the controlled search results listbox'
);

const setActiveStart = appSource.indexOf('function setActiveSearchResult(index) {');
const setActiveEnd = appSource.indexOf('function moveSearchResultSelection(direction) {', setActiveStart);
assert.notEqual(setActiveStart, -1, 'Could not locate setActiveSearchResult');
assert.notEqual(setActiveEnd, -1, 'Could not locate moveSearchResultSelection');
const setActiveSource = appSource.slice(setActiveStart, setActiveEnd);

assert.match(
    setActiveSource,
    /poiSearchInput\.setAttribute\('aria-activedescendant',\s*newActive\.id \|\| ''\)/,
    'Arrow-key selection should update aria-activedescendant on the focused search input'
);
assert.match(
    setActiveSource,
    /poiSearchInput\.removeAttribute\('aria-activedescendant'\)/,
    'Search input active descendant should clear when no result is active'
);
assert.doesNotMatch(
    setActiveSource,
    /searchResultsContainer\.setAttribute\('aria-activedescendant'/,
    'Active descendant should not be assigned to the unfocused results container'
);

const renderStart = appSource.indexOf('function renderSearchResults(term, results) {');
const renderEnd = appSource.indexOf('function sortSearchResults(results) {', renderStart);
assert.notEqual(renderStart, -1, 'Could not locate renderSearchResults');
assert.notEqual(renderEnd, -1, 'Could not locate sortSearchResults');
const renderSource = appSource.slice(renderStart, renderEnd);

assert.doesNotMatch(
    renderSource,
    /resultItem\.setAttribute\('aria-label'/,
    'Search result options should keep their accessible names from visible content'
);
assert.match(
    renderSource,
    /resultItem\.setAttribute\('aria-posinset',\s*String\(index \+ 1\)\)/,
    'Search result options should expose their position without replacing their names'
);
assert.match(
    renderSource,
    /resultItem\.setAttribute\('aria-setsize',\s*String\(results\.length\)\)/,
    'Search result options should expose the result count without replacing their names'
);

console.log('search results accessibility checks passed');
