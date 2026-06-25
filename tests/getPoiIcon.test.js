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

const getPoiTypeIconUrlSource = extractFunctionSource('getPoiTypeIconUrl');
const getPoiIconSource = extractFunctionSource('getPoiIcon');

// Setup mock environment
global.L = {
    icon: (options) => ({ ...options, _isIcon: true })
};

global.poiGroupIconConfig = {
    'KnownGroup': 'known-icon.png',
    'Unknown': 'unknown-icon.png'
};

global.poiTypeIconConfig = {
    'Known Type': 'known-type-icon.png'
};
global.poiTypeIconKeyMap = {
    'known type': 'Known Type'
};

global.poiIconCache = new Map();

// Evaluate the function source code
// eslint-disable-next-line no-eval
eval(getPoiTypeIconUrlSource);
// eslint-disable-next-line no-eval
eval(getPoiIconSource);

// Test 1: Happy path - valid known groupName creates a new L.icon
const icon1 = getPoiIcon('KnownGroup');
assert.equal(icon1._isIcon, true, 'Should create an L.icon object');
assert.equal(icon1.iconUrl, 'known-icon.png', 'Should use the correct iconUrl from config');
assert.deepEqual(icon1.iconSize, [36, 48], 'Should have correct iconSize');

// Test 2: Caching - requesting the same resolved icon URL should return the exact same instance
const icon1Cached = getPoiIcon('KnownGroup');
assert.equal(icon1, icon1Cached, 'Should return the cached icon instance');
assert.equal(global.poiIconCache.has('known-icon.png'), true, 'Should store the group icon by URL in the cache');

// Test 3: Edge case - unknown groupName falls back to "Unknown" config
const iconUnknown = getPoiIcon('NonExistentGroup');
assert.equal(iconUnknown.iconUrl, 'unknown-icon.png', 'Should fallback to "Unknown" iconUrl');
assert.equal(global.poiIconCache.has('unknown-icon.png'), true, 'Should store the fallback icon by URL in cache');

// Test 4: Exact type icon wins over group icon
const typeIcon = getPoiIcon('KnownGroup', 'Known Type');
assert.equal(typeIcon.iconUrl, 'known-type-icon.png', 'Should use a configured type icon before the group icon');

const typeIconLowercase = getPoiIcon('KnownGroup', 'known type');
assert.equal(typeIconLowercase, typeIcon, 'Should resolve configured type icons case-insensitively');


// Test 5: Verify all L.icon configuration properties
assert.deepEqual(icon1.iconAnchor, [18, 47], 'Should have correct iconAnchor');
assert.deepEqual(icon1.popupAnchor, [0, -40], 'Should have correct popupAnchor');
assert.equal(icon1.className, 'poi-custom-icon', 'Should have correct className');

// Test 6: Edge cases with null and undefined
const iconNull = getPoiIcon(null);
assert.equal(iconNull.iconUrl, 'unknown-icon.png', 'Should fallback to "Unknown" iconUrl for null');

const iconUndefined = getPoiIcon();
assert.equal(iconUndefined.iconUrl, 'unknown-icon.png', 'Should fallback to "Unknown" iconUrl for undefined');
console.log('getPoiIcon regression checks passed');
