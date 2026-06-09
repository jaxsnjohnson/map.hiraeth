const assert = require('node:assert/strict');
const fs = require('node:fs');

(() => {
    const appSource = fs.readFileSync('js/app.js', 'utf8');
    const start = appSource.indexOf('function closeSearchResults(');
    if (start === -1) throw new Error('Could not find function closeSearchResults');

    let end = appSource.indexOf('function normalizeSearchValue(', start);
    if (end === -1) {
        end = appSource.length;
    }

    const snippet = appSource.slice(start, end);

    // Mock globals
    global.renderedSearchResults = ['item'];
    global.activeSearchResultIndex = 5;
    global.searchResultsContainer = {
        style: { display: 'block' },
        innerHTML: '<div>results</div>'
    };

    let searchMetaCalledWith = null;
    global.setSearchMeta = (val) => { searchMetaCalledWith = val; };
    global.lastTrackedSearchSignature = 'prev_sig';

    let searchScopeCalledWith = null;
    global.setSearchScope = (val) => { searchScopeCalledWith = val; };
    global.SEARCH_SCOPE_MAP = 'TEST_MAP_SCOPE';

    // Optional functions that might be in the source, these are missing from the simplified snippet so we don't mock them entirely or we mock them just in case
    let syncMobileSearchResultsCardStateCalled = false;
    global.syncMobileSearchResultsCardState = () => { syncMobileSearchResultsCardStateCalled = true; };

    let syncMobileExploreVisibilityCalled = false;
    global.syncMobileExploreVisibility = () => { syncMobileExploreVisibilityCalled = true; };

    let closeSearchResults;
    // eslint-disable-next-line no-eval
    eval(`closeSearchResults = ${snippet}`);

    // Test 1: clearMeta = true (default)
    closeSearchResults();

    assert.deepEqual(global.renderedSearchResults, [], 'renderedSearchResults should be cleared');
    assert.equal(global.activeSearchResultIndex, -1, 'activeSearchResultIndex should be reset');
    assert.equal(global.searchResultsContainer.style.display, 'none', 'container should be hidden');
    assert.equal(global.searchResultsContainer.innerHTML, '', 'container innerHTML should be cleared');

    assert.equal(searchMetaCalledWith, '', 'setSearchMeta should be called with empty string');
    assert.equal(global.lastTrackedSearchSignature, '', 'lastTrackedSearchSignature should be cleared');
    assert.equal(searchScopeCalledWith, 'TEST_MAP_SCOPE', 'setSearchScope should be called with SEARCH_SCOPE_MAP');

    // Reset mocks for Test 2
    global.renderedSearchResults = ['item'];
    global.activeSearchResultIndex = 5;
    global.searchResultsContainer = { style: { display: 'block' }, innerHTML: '<div>results</div>' };
    searchMetaCalledWith = null;
    global.lastTrackedSearchSignature = 'prev_sig';
    searchScopeCalledWith = null;
    syncMobileSearchResultsCardStateCalled = false;
    syncMobileExploreVisibilityCalled = false;

    // Test 2: clearMeta = false
    closeSearchResults({ clearMeta: false });

    assert.deepEqual(global.renderedSearchResults, [], 'renderedSearchResults should be cleared');
    assert.equal(global.activeSearchResultIndex, -1, 'activeSearchResultIndex should be reset');
    assert.equal(global.searchResultsContainer.style.display, 'none', 'container should be hidden');
    assert.equal(global.searchResultsContainer.innerHTML, '', 'container innerHTML should be cleared');

    assert.equal(searchMetaCalledWith, null, 'setSearchMeta should not be called');
    assert.equal(global.lastTrackedSearchSignature, 'prev_sig', 'lastTrackedSearchSignature should not be cleared');
    assert.equal(searchScopeCalledWith, null, 'setSearchScope should not be called');

    console.log('closeSearchResults tests passed');
})();
