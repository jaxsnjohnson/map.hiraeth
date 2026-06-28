const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    buildTileMagickArgs,
    collectTileJobs,
    computeTileLevelPlan,
    normalizeTileSource,
    resolveImageMagickBinary
} = require('../scripts/generate_tiles.js');

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

{
    const tried = [];
    const binary = resolveImageMagickBinary({
        preferredBinary: '',
        commandRunner(command) {
            tried.push(command);
            if (command === 'convert') return { status: 0 };
            return { error: new Error(`spawnSync ${command} ENOENT`) };
        }
    });
    assert.equal(binary, 'convert');
    assert.deepEqual(tried, ['magick', 'convert']);
}

{
    const tried = [];
    const binary = resolveImageMagickBinary({
        preferredBinary: 'custom-magick',
        commandRunner(command) {
            tried.push(command);
            return { status: 0 };
        }
    });
    assert.equal(binary, 'custom-magick');
    assert.deepEqual(tried, ['custom-magick']);
}

assert.throws(
    () => resolveImageMagickBinary({
        preferredBinary: '',
        commandRunner(command) {
            return { error: new Error(`spawnSync ${command} ENOENT`) };
        }
    }),
    /Could not find an ImageMagick command/
);

{
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'map-hiraeth-tile-args-'));
    const levelTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'map-hiraeth-tile-output-'));
    try {
        const sourceImagePath = path.join(root, 'maps', '-quality.webp');
        const args = buildTileMagickArgs(
            {
                mapId: 'dash_source',
                sourceImagePath,
                tileSource: {
                    tileSize: 256,
                    quality: 82
                }
            },
            {
                z: 3,
                scaledWidth: 512,
                scaledHeight: 512,
                extentWidth: 512,
                extentHeight: 512
            },
            levelTmpDir,
            { repoRoot: root }
        );

        assert.equal(args[0], '--');
        assert.equal(args[1], `webp:${sourceImagePath}`);
        assert.equal(args[args.indexOf('-gravity') + 1], 'SouthWest');
        assert.equal(args.at(-1), `webp:${path.join(levelTmpDir, 'tile-%06d.webp')}`);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(levelTmpDir, { recursive: true, force: true });
    }
}

{
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'map-hiraeth-unsafe-image-'));
    try {
        fs.mkdirSync(path.join(root, 'maps'), { recursive: true });
        fs.writeFileSync(path.join(root, 'maps', 'atlas-index.json'), `${JSON.stringify({
            tree: [
                {
                    id: 'unsafe_map',
                    name: 'Unsafe Map',
                    width: 100,
                    height: 100,
                    imageUrl: '@secrets.webp',
                    tileSource: {
                        type: 'xyz',
                        urlTemplate: 'tile/unsafe_map/{z}/{x}/{y}.webp',
                        tileSize: 256,
                        minZoom: 0,
                        maxZoom: 0
                    }
                }
            ]
        })}\n`);

        assert.throws(
            () => collectTileJobs(root),
            /Refusing unsafe ImageMagick source path/
        );
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

console.log('generate_tiles helper checks passed');
