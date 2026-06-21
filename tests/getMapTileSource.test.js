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

// eslint-disable-next-line no-eval
eval([
    extractFunctionSource('parsePositiveInteger'),
    extractFunctionSource('parseNonNegativeInteger'),
    extractFunctionSource('parseFiniteNumber'),
    extractFunctionSource('getMapTileSource')
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
    maxNativeZoom: 0
});

assert.equal(getMapTileSource({}), null);
assert.equal(getMapTileSource({ tileSource: { type: 'xyz', urlTemplate: 'tile/map/{z}/{x}.webp', tileSize: 256, minZoom: 0, maxZoom: 1 } }), null);
assert.equal(getMapTileSource({ tileSource: { type: 'tms', urlTemplate: 'tile/map/{z}/{x}/{y}.webp', tileSize: 256, minZoom: 0, maxZoom: 1 } }), null);

assert.match(
    appSource,
    /currentImageLayer\.on\('tileerror'[\s\S]*attachImageFallback\(\);/,
    'tile load errors should fall back to the full map image.'
);

assert.match(
    appSource,
    /function createSimpleCrsTileLayer\([\s\S]*y: coords\.y < 0 \? -coords\.y - 1 : coords\.y/,
    'CRS.Simple tile rows should be normalized from Leaflet negative y coordinates.'
);

console.log('getMapTileSource checks passed');
