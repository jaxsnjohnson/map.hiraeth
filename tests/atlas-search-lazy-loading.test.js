const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionSource(name) {
    const functionStart = appSource.indexOf(`function ${name}(`);
    if (functionStart === -1) throw new Error(`Could not find function ${name}`);
    const start = appSource.slice(functionStart - 6, functionStart) === 'async '
        ? functionStart - 6
        : functionStart;
    let depth = 0;
    for (let index = start; index < appSource.length; index += 1) {
        if (appSource[index] === '{') depth += 1;
        if (appSource[index] === '}') {
            depth -= 1;
            if (depth === 0) return appSource.slice(start, index + 1);
        }
    }
    throw new Error(`Could not parse function ${name}`);
}

let atlasSearchIndex = [];
let atlasSearchIndexLoaded = false;
let atlasSearchIndexUrl = '';
let atlasSearchIndexPromise = null;
let fetchCalls = 0;
let resolveFetch;
const searchMetaMessages = [];
const prefetchedJsonUrls = new Set();
const searchScopeAtlasBtn = {
    disabled: false,
    attributes: {},
    setAttribute(name, value) {
        this.attributes[name] = value;
    },
    removeAttribute(name) {
        delete this.attributes[name];
    }
};
const focusBeforeLoad = { id: 'atlas-button-focus' };
const unrelatedFocus = { id: 'unrelated-focus' };
const document = { activeElement: searchScopeAtlasBtn };

function fetchJsonAsset(url) {
    fetchCalls += 1;
    assert.equal(url, 'maps/atlas-search-index.json');
    return new Promise((resolve) => {
        resolveFetch = resolve;
    });
}

function withAssetVersion(url) {
    return `${url}?v=test`;
}

function setSearchMeta(message) {
    searchMetaMessages.push(message);
}

// eslint-disable-next-line no-eval
eval(extractFunctionSource('normalizeSearchValue'));
// eslint-disable-next-line no-eval
eval(extractFunctionSource('prepareAtlasSearchIndex'));
// eslint-disable-next-line no-eval
eval(extractFunctionSource('configureAtlasSearchIndex'));
// eslint-disable-next-line no-eval
eval(extractFunctionSource('getAtlasSearchEntryCount'));
// eslint-disable-next-line no-eval
eval(extractFunctionSource('ensureAtlasSearchIndexLoaded'));
// eslint-disable-next-line no-eval
eval(extractFunctionSource('atlasScopeActionStillOwnsFocus'));

async function main() {
    configureAtlasSearchIndex({ searchIndexUrl: 'maps/atlas-search-index.json' });
    assert.equal(atlasSearchIndexLoaded, false);
    assert.equal(getAtlasSearchEntryCount(), 1, 'an unloaded split index should keep Atlas search available');

    const firstLoad = ensureAtlasSearchIndexLoaded();
    const concurrentLoad = ensureAtlasSearchIndexLoaded();
    assert.equal(fetchCalls, 1, 'concurrent requests should share one atlas search fetch');
    assert.equal(searchScopeAtlasBtn.disabled, false);
    assert.equal(searchScopeAtlasBtn.attributes['aria-busy'], 'true');
    assert.equal(searchScopeAtlasBtn.attributes['aria-disabled'], 'true');
    assert.equal(searchMetaMessages.at(-1), 'Loading atlas search…');

    resolveFetch({
        searchIndex: [{
            kind: 'poi',
            mapId: 'map-a',
            mapName: 'Map A',
            name: 'Bright Harbor',
            typeLabel: 'City',
            summary: 'A busy port'
        }]
    });
    const [firstEntries, concurrentEntries] = await Promise.all([firstLoad, concurrentLoad]);
    assert.equal(firstEntries, concurrentEntries);
    assert.equal(firstEntries.length, 1);
    assert.equal(firstEntries[0]._normalizedName, 'bright harbor');
    assert.match(firstEntries[0]._normalizedSearchContent, /map a city a busy port/);
    assert.equal(atlasSearchIndexLoaded, true);
    assert.equal(searchScopeAtlasBtn.disabled, false);
    assert.equal('aria-busy' in searchScopeAtlasBtn.attributes, false);
    assert.equal('aria-disabled' in searchScopeAtlasBtn.attributes, false);
    assert.equal(prefetchedJsonUrls.has('maps/atlas-search-index.json?v=test'), true);

    assert.equal(atlasScopeActionStillOwnsFocus(focusBeforeLoad, focusBeforeLoad), true);
    assert.equal(atlasScopeActionStillOwnsFocus(focusBeforeLoad, searchScopeAtlasBtn), true);
    assert.equal(atlasScopeActionStillOwnsFocus(focusBeforeLoad, unrelatedFocus), false);

    await ensureAtlasSearchIndexLoaded();
    assert.equal(fetchCalls, 1, 'a loaded atlas search index should not be fetched again');

    configureAtlasSearchIndex({
        searchIndex: [{ name: 'Embedded Atlas', mapName: '', typeLabel: '', summary: '' }]
    });
    assert.equal(atlasSearchIndexLoaded, true);
    assert.equal(atlasSearchIndex[0]._normalizedName, 'embedded atlas');
    assert.equal(getAtlasSearchEntryCount(), 1);

    assert.match(
        appSource,
        /const entries = await ensureAtlasSearchIndexLoaded\(\)/,
        'the Atlas scope action should wait for its lazy payload before rendering results'
    );
    assert.match(
        appSource,
        /if \(entries === null\) \{\s*setSearchScope\(SEARCH_SCOPE_MAP\);/,
        'a failed lazy request should leave the next Atlas action ready to retry'
    );
    assert.match(
        appSource,
        /if \(searchScopeAtlasBtn\.getAttribute\('aria-busy'\) === 'true'\) return;/,
        'repeated Atlas actions should be ignored while the shared request is pending'
    );
    assert.match(
        appSource,
        /const activeElementBeforeLoad = document\.activeElement;[\s\S]*atlasScopeActionStillOwnsFocus\(activeElementBeforeLoad\)/,
        'Atlas loading should not steal focus after the user moves elsewhere'
    );
    assert.doesNotMatch(
        appSource,
        /if \(!searchTerm\) \{\s*setSearchScope\(SEARCH_SCOPE_MAP\);\s*closeSearchResults\(\);/,
        'an empty search should keep the selected scope ready for the next query'
    );
    assert.match(
        appSource,
        /if \(!searchTerm\) \{\s*closeSearchResults\(\{ preserveScope: true \}\);/,
        'an empty search should clear stale status without resetting its scope'
    );
    assert.match(
        appSource,
        /function resetMapState\(\) \{[\s\S]*poiSearchInput\.value = '';\s*setSearchScope\(SEARCH_SCOPE_MAP\);/,
        'loading another map should explicitly restore the current-map search scope'
    );

    console.log('lazy atlas search index checks passed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
