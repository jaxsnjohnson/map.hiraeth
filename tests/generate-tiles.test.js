const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    buildTileMagickArgs,
    collectTileJobs,
    computeTileLevelPlan,
    createTileManifestMap,
    generateTiles,
    getTileCacheVersion,
    getTileJobFingerprint,
    getTileLevelQuality,
    isCachedTileMapReusable,
    normalizeTileSource,
    resolveImageMagickBinary,
    validateTileSourceDimensions
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
    quality: 90,
    overviewQuality: 82
});

assert.equal(getTileLevelQuality(tileSource, { z: 1 }), 82);
assert.equal(getTileLevelQuality(tileSource, { z: 2 }), 84);
assert.equal(getTileLevelQuality(tileSource, { z: 3 }), 86);
assert.equal(getTileLevelQuality(tileSource, { z: 4 }), 88);
assert.equal(getTileLevelQuality(tileSource, { z: 5 }), 90);
assert.equal(getTileCacheVersion('ABCDEF0123456789abcdef0123456789'), 'abcdef0123456789');
assert.throws(() => getTileCacheVersion('too-short'), /at least 16 hexadecimal/);

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
    fairPlan.levels.at(-1),
    {
        z: 5,
        scale: 1,
        scaledWidth: 8192,
        scaledHeight: 6144,
        columns: 32,
        rows: 24,
        extentWidth: 8192,
        extentHeight: 6144,
        tileCount: 768
    },
    'the highest tile level must retain the source map resolution'
);
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
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'map-hiraeth-dimension-check-'));
    try {
        const sourceImagePath = path.join(root, 'maps', 'dimensions.webp');
        fs.mkdirSync(path.dirname(sourceImagePath), { recursive: true });
        fs.writeFileSync(sourceImagePath, 'fixture');
        const job = {
            mapId: 'dimension_map',
            imageUrl: 'maps/dimensions.webp',
            sourceImagePath,
            width: 800,
            height: 600
        };
        const commandRunner = (command, args) => {
            assert.equal(command, 'fixture-magick');
            assert.ok(args.includes(`webp:${sourceImagePath}`));
            return { status: 0, stdout: '800|600\n', stderr: '' };
        };

        assert.doesNotThrow(() => validateTileSourceDimensions([job], {
            repoRoot: root,
            magickBinary: 'fixture-magick',
            commandRunner
        }));
        assert.throws(
            () => validateTileSourceDimensions([{ ...job, width: 801 }], {
                repoRoot: root,
                magickBinary: 'fixture-magick',
                commandRunner
            }),
            /map data declares 801x600, but maps\/dimensions\.webp is 800x600/
        );
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

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
                    minZoom: 1,
                    maxZoom: 5,
                    overviewQuality: 82,
                    quality: 90
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
        assert.equal(args[args.indexOf('-quality') + 1], '86');
        assert.ok(args.includes('webp:method=6'));
        assert.ok(args.includes('webp:use-sharp-yuv=1'));
        assert.equal(args.at(-1), `webp:${path.join(levelTmpDir, 'tile-%06d.webp')}`);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(levelTmpDir, { recursive: true, force: true });
    }
}

{
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'map-hiraeth-tile-cache-'));
    const outputDir = path.join(root, 'tile-cache');
    try {
        fs.mkdirSync(path.join(root, 'maps'), { recursive: true });
        fs.writeFileSync(path.join(root, 'maps', 'cached-map.webp'), 'render-source-v1');
        fs.writeFileSync(path.join(root, 'maps', 'atlas-index.json'), `${JSON.stringify({
            tree: [
                {
                    id: 'cached_map',
                    name: 'Cached Map',
                    width: 64,
                    height: 64,
                    imageUrl: 'maps/cached-map.webp',
                    tileSource: {
                        type: 'xyz',
                        urlTemplate: 'tile/cached_map/{z}/{x}/{y}.webp',
                        tileSize: 256,
                        minZoom: 0,
                        maxZoom: 0
                    }
                }
            ]
        })}\n`);

        const [job] = collectTileJobs(root);
        const fingerprint = getTileJobFingerprint(job);
        const manifestMap = createTileManifestMap(job, fingerprint);
        assert.equal(manifestMap.cacheVersion, fingerprint.slice(0, 16));
        const tilePath = path.join(outputDir, 'cached_map', '0', '0', '0.webp');
        fs.mkdirSync(path.dirname(tilePath), { recursive: true });
        fs.writeFileSync(tilePath, 'cached-tile');
        fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify({
            maps: [manifestMap],
            totalTiles: 1
        })}\n`);

        assert.equal(isCachedTileMapReusable(outputDir, job, manifestMap, fingerprint), true);
        const legacyManifestMap = { ...manifestMap };
        delete legacyManifestMap.fingerprint;
        assert.equal(
            isCachedTileMapReusable(outputDir, job, legacyManifestMap, fingerprint),
            false,
            'cached tiles without an exact content fingerprint must be regenerated'
        );
        const logs = [];
        const result = generateTiles({
            repoRoot: root,
            outputDir,
            reuseExisting: true,
            magickBinary: 'must-not-run',
            logger: { log: (message) => logs.push(message) }
        });
        assert.equal(result.reusedMaps, 1);
        assert.equal(result.generatedMaps, 0);
        assert.equal(fs.readFileSync(tilePath, 'utf8'), 'cached-tile');
        assert.equal(logs.some((message) => message.includes('Reused 1 cached map tile set')), true);

        fs.writeFileSync(job.sourceImagePath, 'render-source-v2');
        assert.notEqual(getTileJobFingerprint(job), fingerprint);
        assert.equal(isCachedTileMapReusable(outputDir, job, manifestMap), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
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
