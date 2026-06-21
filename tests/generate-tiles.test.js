const assert = require('node:assert/strict');

const { computeTileLevelPlan, normalizeTileSource } = require('../scripts/generate_tiles.js');

const tileSource = normalizeTileSource({
    type: 'xyz',
    urlTemplate: 'tile/main_continent/{z}/{x}/{y}.webp',
    tileSize: 256,
    minZoom: 1,
    maxZoom: 5
});

assert.deepEqual(tileSource, {
    type: 'xyz',
    urlTemplate: 'tile/main_continent/{z}/{x}/{y}.webp',
    tileSize: 256,
    minZoom: 1,
    maxZoom: 5,
    quality: 82
});

const fairPlan = computeTileLevelPlan({
    id: 'main_continent',
    name: 'Fair',
    width: 8192,
    height: 6144,
    imageUrl: 'maps/Fair-Content.webp',
    tileSource
});

assert.ok(fairPlan);
assert.equal(fairPlan.mapId, 'main_continent');
assert.equal(fairPlan.levels.length, 5);
assert.equal(fairPlan.totalTiles, 1024);
assert.deepEqual(
    fairPlan.levels.map(({ z, columns, rows, tileCount }) => ({ z, columns, rows, tileCount })),
    [
        { z: 1, columns: 2, rows: 2, tileCount: 4 },
        { z: 2, columns: 4, rows: 3, tileCount: 12 },
        { z: 3, columns: 8, rows: 6, tileCount: 48 },
        { z: 4, columns: 16, rows: 12, tileCount: 192 },
        { z: 5, columns: 32, rows: 24, tileCount: 768 }
    ]
);

assert.equal(normalizeTileSource({ type: 'xyz', urlTemplate: 'tile/map/{z}/{x}.webp', tileSize: 256, minZoom: 0, maxZoom: 1 }), null);
assert.equal(computeTileLevelPlan({ width: 0, height: 100, tileSource }), null);

console.log('generate_tiles helper checks passed');
