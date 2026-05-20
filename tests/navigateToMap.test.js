const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const start = appSource.indexOf('function navigateToMap');
const end = appSource.indexOf('function resolveInitialMapViewport');

if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate navigateToMap in js/app.js');
}

const functionSource = appSource.slice(start, end);

// Globals used by the function
global.window = {
    location: {
        search: '?foo=bar',
        pathname: '/app/',
        hash: '#old-hash'
    }
};

global.history = {
    pushState: () => {}
};

global.currentSidebarState = 'default-state';
global.isMobileLayoutActive = false;

// Mock functions
let pushStateArgs = null;
global.history.pushState = (...args) => {
    pushStateArgs = args;
};

let clearTransientMapSearchParamsArgs = null;
global.clearTransientMapSearchParams = (search) => {
    clearTransientMapSearchParamsArgs = search;
    return '?cleared=true';
};

let generateHashArgs = null;
global.generateHash = (mapId, sidebarState) => {
    generateHashArgs = { mapId, sidebarState };
    return `#map-${mapId}`;
};

let buildAppUrlWithHashArgs = null;
global.buildAppUrlWithHash = (hash, search) => {
    buildAppUrlWithHashArgs = { hash, search };
    return `/app/${search}${hash}`;
};

let closeMobileSheetArgs = null;
let closeMobileSheetCalled = false;
global.closeMobileSheet = (args) => {
    closeMobileSheetCalled = true;
    closeMobileSheetArgs = args;
};

let loadMapArgs = null;
global.loadMap = (mapId, pushState, preResolvedMap) => {
    loadMapArgs = { mapId, pushState, preResolvedMap };
};

// Evaluate the function
eval(functionSource);

// Helper to reset state between tests
function resetState() {
    global.window.location = {
        search: '?foo=bar',
        pathname: '/app/',
        hash: '#old-hash'
    };
    global.currentSidebarState = 'default-state';
    global.isMobileLayoutActive = false;

    pushStateArgs = null;
    clearTransientMapSearchParamsArgs = null;
    generateHashArgs = null;
    buildAppUrlWithHashArgs = null;
    closeMobileSheetCalled = false;
    closeMobileSheetArgs = null;
    loadMapArgs = null;
}

(function testNavigateToMap() {
    console.log('Running testNavigateToMap...');

    // Test 1: Default behavior, URL changes
    resetState();
    navigateToMap('test-map');

    assert.deepEqual(clearTransientMapSearchParamsArgs, '?foo=bar');
    assert.deepEqual(generateHashArgs, { mapId: 'test-map', sidebarState: 'default-state' });
    assert.deepEqual(buildAppUrlWithHashArgs, { hash: '#map-test-map', search: '?cleared=true' });

    assert.notEqual(pushStateArgs, null, 'history.pushState should be called when URL changes');
    assert.deepEqual(pushStateArgs[0], {
        mapId: 'test-map',
        sidebarState: 'default-state',
        search: '?cleared=true',
        hash: '#map-test-map'
    });
    assert.equal(pushStateArgs[1], '');
    assert.equal(pushStateArgs[2], '/app/?cleared=true#map-test-map');

    assert.equal(closeMobileSheetCalled, false, 'closeMobileSheet should not be called if not mobile layout');

    assert.deepEqual(loadMapArgs, { mapId: 'test-map', pushState: false, preResolvedMap: null });

    // Test 2: URL does not change
    resetState();
    // Setup buildAppUrlWithHash to return exactly the current URL
    global.buildAppUrlWithHash = () => '/app/?foo=bar#old-hash';
    navigateToMap('test-map');

    assert.equal(pushStateArgs, null, 'history.pushState should not be called if URL is identical');
    assert.deepEqual(loadMapArgs, { mapId: 'test-map', pushState: false, preResolvedMap: null });

    // Restore original mock
    global.buildAppUrlWithHash = (hash, search) => {
        buildAppUrlWithHashArgs = { hash, search };
        return `/app/${search}${hash}`;
    };

    // Test 3: preserveSearch = true
    resetState();
    navigateToMap('test-map', { preserveSearch: true });

    assert.equal(clearTransientMapSearchParamsArgs, null, 'Should not clear transient params when preserveSearch is true');
    assert.deepEqual(buildAppUrlWithHashArgs, { hash: '#map-test-map', search: '?foo=bar' });
    assert.equal(pushStateArgs[0].search, '?foo=bar');

    // Test 4: isMobileLayoutActive = true
    resetState();
    global.isMobileLayoutActive = true;
    navigateToMap('test-map');

    assert.equal(closeMobileSheetCalled, true, 'closeMobileSheet should be called when mobile layout is active');
    assert.deepEqual(closeMobileSheetArgs, { restoreFocus: false });

    // Test 5: preResolvedMap is passed
    resetState();
    const mockPreResolvedMap = { id: 'test-map', data: {} };
    navigateToMap('test-map', { preResolvedMap: mockPreResolvedMap });

    assert.deepEqual(loadMapArgs, { mapId: 'test-map', pushState: false, preResolvedMap: mockPreResolvedMap });

    console.log('All tests passed!');
})();
