const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const setupStart = appSource.indexOf('function setupMapImageLoading(');
const setupEnd = appSource.indexOf('\nasync function loadMap(', setupStart);

assert.notEqual(setupStart, -1, 'setupMapImageLoading should exist');
assert.notEqual(setupEnd, -1, 'loadMap should follow setupMapImageLoading');

const setupSource = appSource.slice(setupStart, setupEnd);
assert.match(
    setupSource,
    /requestToken \}\) \{[\s\S]*function isActiveMapLoad\(\) \{\s*return requestToken === loadRequestToken;/,
    'map image callbacks should be bound to the request that created them'
);
assert.ok(
    (setupSource.match(/!isActiveMapLoad\(\)/g) || []).length >= 8,
    'every delayed tile, preview, and fallback path should reject stale map loads'
);
assert.match(
    appSource,
    /setupMapImageLoading\(\{ requestedMapId, selectedMap, mapImageUrl, usingAlternateMobileImage, loadStartedAt, updateHash, requestToken \}\);/,
    'loadMap should pass its request token into image loading'
);

console.log('map load race regression checks passed');
