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

const mapOptions = { minZoom: -4, maxZoom: 4 };
let tileAssetRoot = 'tile';
function getConfigValue(path, fallbackValue) {
    if (path === 'performance.tileAssetRoot') return tileAssetRoot;
    return fallbackValue;
}

// eslint-disable-next-line no-eval
eval([
    extractFunctionSource('parsePositiveInteger'),
    extractFunctionSource('parseNonNegativeInteger'),
    extractFunctionSource('parseFiniteNumber'),
    extractFunctionSource('normalizeTileAssetRoot'),
    extractFunctionSource('resolveTileUrlTemplate'),
    extractFunctionSource('getMapTileSource'),
    extractFunctionSource('getGeneratedTileRowCount'),
    extractFunctionSource('normalizeSimpleCrsTileCoords'),
    extractFunctionSource('getTileLayerImageCounts'),
    extractFunctionSource('areAllObservedTilesFailed')
].join('\n'));

const normalized = getMapTileSource({
    tileSource: {
        type: 'xyz',
        urlTemplate: 'tile/main_continent/{z}/{x}/{y}.webp',
        tileSize: 256,
        minZoom: 1,
        maxZoom: 5,
        leafletNativeZoom: 0,
        zoomOffset: 5
    }
});

assert.deepEqual(normalized, {
    type: 'xyz',
    urlTemplate: 'tile/main_continent/{z}/{x}/{y}.webp',
    tileSize: 256,
    minZoom: 1,
    maxZoom: 5,
    leafletNativeZoom: 0,
    zoomOffset: 5,
    minNativeZoom: -4,
    maxNativeZoom: 0,
    cacheVersion: ''
});

assert.equal(
    getMapTileSource({
        tileSource: {
            type: 'xyz',
            urlTemplate: 'tile/main_continent/{z}/{x}/{y}.webp',
            minZoom: 1,
            maxZoom: 5,
            cacheVersion: 'abcdef0123456789'
        }
    }).cacheVersion,
    'abcdef0123456789'
);

tileAssetRoot = 'dist/tile';
assert.equal(
    getMapTileSource({
        tileSource: {
            type: 'xyz',
            urlTemplate: 'tile/main_continent/{z}/{x}/{y}.webp',
            tileSize: 256,
            minZoom: 1,
            maxZoom: 5
        }
    }).urlTemplate,
    'dist/tile/main_continent/{z}/{x}/{y}.webp',
    'root Pages deployments should rewrite map tile templates to the configured generated tile bundle'
);

assert.equal(
    getMapTileSource({
        tileSource: {
            type: 'xyz',
            urlTemplate: 'dist/tile/main_continent/{z}/{x}/{y}.webp',
            tileSize: 256,
            minZoom: 1,
            maxZoom: 5
        }
    }).urlTemplate,
    'dist/tile/main_continent/{z}/{x}/{y}.webp',
    'tile templates already using the configured root should not be double-prefixed'
);
tileAssetRoot = 'tile';

assert.equal(getMapTileSource({}), null);
assert.equal(getMapTileSource({ tileSource: { type: 'xyz', urlTemplate: 'tile/map/{z}/{x}.webp', tileSize: 256, minZoom: 0, maxZoom: 1 } }), null);
assert.equal(getMapTileSource({ tileSource: { type: 'tms', urlTemplate: 'tile/map/{z}/{x}/{y}.webp', tileSize: 256, minZoom: 0, maxZoom: 1 } }), null);

assert.match(
    appSource,
    /currentImageLayer\.on\('tileerror'[\s\S]*attachImageFallback\(\);/,
    'tile load errors should fall back to the full map image.'
);

const simpleCrsTileOptions = {
    sourceHeight: 6144,
    sourceMaxZoom: 5,
    tileSize: 256
};

assert.equal(getGeneratedTileRowCount(simpleCrsTileOptions, 1), 2);
assert.equal(getGeneratedTileRowCount(simpleCrsTileOptions, 2), 3);
assert.equal(getGeneratedTileRowCount({}, 1), null);

assert.deepEqual(
    normalizeSimpleCrsTileCoords({ x: 0, y: -2, z: -4 }, simpleCrsTileOptions, 1),
    { x: 0, y: 0, z: -4 }
);
assert.deepEqual(
    normalizeSimpleCrsTileCoords({ x: 0, y: -1, z: -4 }, simpleCrsTileOptions, 1),
    { x: 0, y: 1, z: -4 }
);
assert.deepEqual(
    normalizeSimpleCrsTileCoords({ x: 0, y: -3, z: -3 }, simpleCrsTileOptions, 2),
    { x: 0, y: 0, z: -3 }
);
assert.deepEqual(
    normalizeSimpleCrsTileCoords({ x: 0, y: 0, z: -4 }, simpleCrsTileOptions, 1),
    { x: 0, y: 0, z: -4 }
);

const loadedTile = { complete: true, naturalWidth: 256 };
const pendingTile = { complete: false, naturalWidth: 0 };
const failedTile = { complete: true, naturalWidth: 0 };

assert.deepEqual(getTileLayerImageCounts(null), { total: 0, loaded: 0, failed: 0 });
assert.deepEqual(
    getTileLayerImageCounts({
        querySelectorAll(selector) {
            assert.equal(selector, 'img.leaflet-tile');
            return [loadedTile, pendingTile, failedTile];
        }
    }),
    { total: 3, loaded: 1, failed: 1 }
);

assert.equal(areAllObservedTilesFailed({ total: 0, loaded: 0, failed: 0 }), false);
assert.equal(areAllObservedTilesFailed({ total: 2, loaded: 0, failed: 2 }), true);
assert.equal(areAllObservedTilesFailed({ total: 2, loaded: 1, failed: 1 }), false);

assert.match(
    appSource,
    /function handleTileLayerLoad\(\) \{[\s\S]*hasOnlyFailedVisibleTiles\(\)[\s\S]*falling back to full map image[\s\S]*setTimeout\(attachImageFallback, 0\);[\s\S]*return;[\s\S]*finishDetailLoading\(\);[\s\S]*\}/,
    'tile load completion should fall back to the full map image when every observed tile failed.'
);

assert.match(
    appSource,
    /currentImageLayer\.on\('load', handleTileLayerLoad\);/,
    'tile layer load completion should use the fallback-aware load handler.'
);

assert.match(
    appSource,
    /function createSimpleCrsTileLayer\([\s\S]*normalizeSimpleCrsTileCoords\(coords, this\.options, tileZoom\)/,
    'CRS.Simple tile rows should be normalized from Leaflet negative y coordinates using generated row counts.'
);

assert.match(
    appSource,
    /sourceHeight: selectedMap\.height,/,
    'tile row normalization should use the selected map height inside createMapBaseLayer.'
);

assert.match(
    appSource,
    /updateWhenZooming:\s*false,/,
    'tile layers should keep the current tiles visible during wheel zoom instead of swapping to blank unloaded levels.'
);

assert.match(
    appSource,
    /withAssetVersion\(tileSource\.urlTemplate, tileSource\.cacheVersion\)/,
    'tile requests should use their map fingerprint instead of invalidating every map on shell-only releases.'
);

console.log('getMapTileSource checks passed');
