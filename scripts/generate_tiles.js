#!/usr/bin/env node

const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const defaultTileSize = 256;
const defaultQuality = 90;
const defaultOverviewQuality = 82;
// Bump when rendering or cache-manifest compatibility changes so stale tiles cannot be reused.
const tileRendererVersion = '2';
const imageMagickCodersByExtension = new Map([
    ['.gif', 'gif'],
    ['.jpeg', 'jpeg'],
    ['.jpg', 'jpeg'],
    ['.png', 'png'],
    ['.webp', 'webp']
]);

function isObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readJsonFile(fullPath) {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function toPositiveInteger(value, fallbackValue) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function toNonNegativeInteger(value, fallbackValue) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallbackValue;
}

function toWebpQuality(value, fallbackValue) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : fallbackValue;
}

function normalizeTileSource(tileSource) {
    if (!isObject(tileSource)) return null;
    const type = String(tileSource.type || 'xyz').trim().toLowerCase();
    const urlTemplate = String(tileSource.urlTemplate || '').trim();
    if (type !== 'xyz') return null;
    if (!urlTemplate || !urlTemplate.includes('{z}') || !urlTemplate.includes('{x}') || !urlTemplate.includes('{y}')) {
        return null;
    }

    const tileSize = toPositiveInteger(tileSource.tileSize, defaultTileSize);
    const maxZoom = toNonNegativeInteger(tileSource.maxZoom, null);
    if (!Number.isInteger(maxZoom)) return null;
    const minZoom = toNonNegativeInteger(tileSource.minZoom, Math.max(0, maxZoom - 4));
    if (minZoom > maxZoom) return null;

    const quality = toWebpQuality(tileSource.quality, defaultQuality);
    return {
        type,
        urlTemplate,
        tileSize,
        minZoom,
        maxZoom,
        quality,
        overviewQuality: Math.min(
            quality,
            toWebpQuality(tileSource.overviewQuality, Math.min(defaultOverviewQuality, quality))
        )
    };
}

function getTileLevelQuality(tileSource, level) {
    const minZoom = Number(tileSource?.minZoom);
    const maxZoom = Number(tileSource?.maxZoom);
    const zoom = Number(level?.z);
    const detailQuality = toWebpQuality(tileSource?.quality, defaultQuality);
    const overviewQuality = Math.min(
        detailQuality,
        toWebpQuality(tileSource?.overviewQuality, Math.min(defaultOverviewQuality, detailQuality))
    );
    if (!Number.isFinite(zoom) || !Number.isFinite(minZoom) || !Number.isFinite(maxZoom) || maxZoom <= minZoom) {
        return detailQuality;
    }
    const progress = Math.max(0, Math.min(1, (zoom - minZoom) / (maxZoom - minZoom)));
    return Math.round(overviewQuality + ((detailQuality - overviewQuality) * progress));
}

function computeTileLevelPlan(mapDocument, tileSource = normalizeTileSource(mapDocument?.tileSource)) {
    if (!isObject(mapDocument) || !tileSource) return null;
    const width = Number(mapDocument.width);
    const height = Number(mapDocument.height);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        return null;
    }

    const levels = [];
    let totalTiles = 0;
    for (let z = tileSource.minZoom; z <= tileSource.maxZoom; z += 1) {
        const scale = Math.pow(2, z - tileSource.maxZoom);
        const scaledWidth = Math.max(1, Math.ceil(width * scale));
        const scaledHeight = Math.max(1, Math.ceil(height * scale));
        const columns = Math.ceil(scaledWidth / tileSource.tileSize);
        const rows = Math.ceil(scaledHeight / tileSource.tileSize);
        const tileCount = columns * rows;
        totalTiles += tileCount;
        levels.push({
            z,
            scale,
            scaledWidth,
            scaledHeight,
            columns,
            rows,
            tileCount,
            extentWidth: columns * tileSource.tileSize,
            extentHeight: rows * tileSource.tileSize
        });
    }

    return {
        mapId: String(mapDocument.id || '').trim(),
        name: String(mapDocument.name || mapDocument.id || '').trim(),
        width,
        height,
        imageUrl: String(mapDocument.imageUrl || '').trim(),
        tileSource,
        levels,
        totalTiles
    };
}

function assertSafeImageMagickSourcePath(relativePath) {
    if (/[\0\r\n]/.test(relativePath)) {
        throw new Error(`Refusing unsafe ImageMagick source path: ${relativePath}`);
    }
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(relativePath) || relativePath.startsWith('@') || relativePath === '-') {
        throw new Error(`Refusing unsafe ImageMagick source path: ${relativePath}`);
    }
    if (/[*?[\]{}]/.test(relativePath)) {
        throw new Error(`Refusing unsafe ImageMagick source path: ${relativePath}`);
    }
    if (!imageMagickCodersByExtension.has(path.extname(relativePath).toLowerCase())) {
        throw new Error(`Unsupported ImageMagick source image type: ${relativePath}`);
    }
}

function resolveSafeRepoPath(root, relativePath, options = {}) {
    const normalized = String(relativePath || '').trim();
    if (options.forImageMagick) assertSafeImageMagickSourcePath(normalized);
    const resolved = path.resolve(root, normalized);
    if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) {
        throw new Error(`Refusing to resolve path outside repository: ${relativePath}`);
    }
    return resolved;
}

function resolveSafeOutputPath(outputDir, relativePath = '') {
    const resolved = path.resolve(outputDir, relativePath);
    if (!resolved.startsWith(`${outputDir}${path.sep}`) && resolved !== outputDir) {
        throw new Error(`Refusing to write tile path outside output directory: ${relativePath}`);
    }
    return resolved;
}

function walkAtlasTree(nodes, visit) {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node) => {
        if (!isObject(node)) return;
        visit(node);
        if (Array.isArray(node.children)) walkAtlasTree(node.children, visit);
    });
}

function collectTileJobs(root = repoRoot) {
    const atlasPath = path.join(root, 'maps', 'atlas-index.json');
    const atlas = readJsonFile(atlasPath);
    const jobsById = new Map();

    walkAtlasTree(atlas.tree, (node) => {
        const sourcePath = String(node.dataUrl || '').trim();
        const mapDocument = sourcePath ? readJsonFile(resolveSafeRepoPath(root, sourcePath)) : node;
        const tileSource = normalizeTileSource(mapDocument.tileSource || node.tileSource);
        const plan = computeTileLevelPlan(mapDocument, tileSource);
        if (!plan || !plan.mapId || !plan.imageUrl || jobsById.has(plan.mapId)) return;
        jobsById.set(plan.mapId, {
            ...plan,
            sourceImagePath: resolveSafeRepoPath(root, plan.imageUrl, { forImageMagick: true })
        });
    });

    return Array.from(jobsById.values());
}

function serializeTileJobForFingerprint(job) {
    return JSON.stringify({
        mapId: job.mapId,
        width: job.width,
        height: job.height,
        imageUrl: job.imageUrl,
        tileSource: job.tileSource,
        levels: job.levels.map(({ z, scaledWidth, scaledHeight, columns, rows }) => ({
            z,
            scaledWidth,
            scaledHeight,
            columns,
            rows
        }))
    });
}

function getTileJobFingerprint(job) {
    const hash = crypto.createHash('sha256');
    hash.update(tileRendererVersion);
    hash.update(serializeTileJobForFingerprint(job));
    hash.update(fs.readFileSync(job.sourceImagePath));
    return hash.digest('hex');
}

function getTileCacheVersion(fingerprint) {
    const normalized = String(fingerprint || '').trim().toLowerCase();
    if (!/^[a-f0-9]{16,}$/.test(normalized)) {
        throw new Error('Tile cache fingerprints must contain at least 16 hexadecimal characters.');
    }
    return normalized.slice(0, 16);
}

function getTileSetFingerprint(jobFingerprints) {
    const hash = crypto.createHash('sha256');
    [...jobFingerprints]
        .sort((left, right) => left.mapId.localeCompare(right.mapId))
        .forEach(({ mapId, fingerprint }) => {
            hash.update(mapId);
            hash.update(':');
            hash.update(fingerprint);
            hash.update('\n');
        });
    return hash.digest('hex');
}

function getTileBuildFingerprint(root = repoRoot) {
    const jobs = collectTileJobs(path.resolve(root));
    return getTileSetFingerprint(jobs.map((job) => ({
        mapId: job.mapId,
        fingerprint: getTileJobFingerprint(job)
    })));
}

function resolveImageMagickBinary(options = {}) {
    const commandRunner = options.commandRunner || spawnSync;
    const preferredBinary = String(options.preferredBinary ?? process.env.MAGICK_BINARY ?? '').trim();
    const candidates = preferredBinary ? [preferredBinary] : ['magick', 'convert'];
    const failures = [];

    for (const candidate of candidates) {
        const result = commandRunner(candidate, ['-version'], { stdio: 'pipe', encoding: 'utf8' });
        if (!result.error && result.status === 0) return candidate;
        const reason = result.error
            ? result.error.message
            : `exited with ${result.status}`;
        failures.push(`${candidate}: ${reason}`);
    }

    if (preferredBinary) {
        throw new Error(`Configured ImageMagick binary "${preferredBinary}" is not available (${failures.join('; ')}).`);
    }
    throw new Error(`Could not find an ImageMagick command. Tried ${candidates.join(', ')}. Install ImageMagick or set MAGICK_BINARY.`);
}

function runMagick(args, label, magickBinary) {
    const result = spawnSync(magickBinary, args, { stdio: 'pipe', encoding: 'utf8' });
    if (result.error) {
        throw new Error(`${label}: ${result.error.message}`);
    }
    if (result.status !== 0) {
        const stderr = String(result.stderr || '').trim();
        throw new Error(`${label}: ImageMagick exited with ${result.status}${stderr ? `\n${stderr}` : ''}`);
    }
    return result;
}

function isPathInside(root, candidate) {
    const resolvedRoot = path.resolve(root);
    const resolvedCandidate = path.resolve(candidate);
    return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

function formatMagickImagePath(filePath, label, allowedRoot) {
    const rawPath = String(filePath || '');
    const resolvedPath = path.resolve(rawPath);
    if (!rawPath || !path.isAbsolute(rawPath) || rawPath !== resolvedPath) {
        throw new Error(`${label}: expected a normalized absolute path.`);
    }
    if (/[\0\r\n]/.test(rawPath)) {
        throw new Error(`${label}: unsafe ImageMagick path.`);
    }
    if (!isPathInside(allowedRoot, resolvedPath)) {
        throw new Error(`${label}: refusing ImageMagick path outside allowed directory.`);
    }

    const coder = imageMagickCodersByExtension.get(path.extname(resolvedPath).toLowerCase());
    if (!coder) {
        throw new Error(`${label}: unsupported ImageMagick image type.`);
    }
    return `${coder}:${resolvedPath}`;
}

function buildTileMagickArgs(job, level, levelTmpDir, options = {}) {
    const outputPattern = path.join(levelTmpDir, 'tile-%06d.webp');
    const levelQuality = getTileLevelQuality(job.tileSource, level);
    return [
        '--',
        formatMagickImagePath(job.sourceImagePath, `${job.mapId} source image`, options.repoRoot || repoRoot),
        '-auto-orient',
        '-resize',
        `${level.scaledWidth}x${level.scaledHeight}!`,
        '-background',
        'none',
        '-gravity',
        'SouthWest',
        '-extent',
        `${level.extentWidth}x${level.extentHeight}`,
        '-crop',
        `${job.tileSource.tileSize}x${job.tileSource.tileSize}`,
        '+repage',
        '-define',
        'webp:method=6',
        '-define',
        'webp:use-sharp-yuv=1',
        '-quality',
        String(levelQuality),
        formatMagickImagePath(outputPattern, `${job.mapId} z${level.z} output pattern`, levelTmpDir)
    ];
}

function validateTileSourceDimensions(jobs, options = {}) {
    if (!Array.isArray(jobs) || jobs.length === 0) return;
    const root = path.resolve(options.repoRoot || repoRoot);
    const magickBinary = options.magickBinary || resolveImageMagickBinary(options);
    const commandRunner = options.commandRunner || spawnSync;
    const args = [
        '-ping',
        '--',
        ...jobs.map((job) => formatMagickImagePath(job.sourceImagePath, `${job.mapId} source image`, root)),
        '-format',
        '%w|%h\\n',
        'info:'
    ];
    const result = commandRunner(magickBinary, args, { stdio: 'pipe', encoding: 'utf8' });
    if (result.error) {
        throw new Error(`Map source dimension check: ${result.error.message}`);
    }
    if (result.status !== 0) {
        const stderr = String(result.stderr || '').trim();
        throw new Error(`Map source dimension check: ImageMagick exited with ${result.status}${stderr ? `\n${stderr}` : ''}`);
    }

    const dimensions = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean);
    if (dimensions.length !== jobs.length) {
        throw new Error(`Map source dimension check returned ${dimensions.length} results for ${jobs.length} maps.`);
    }
    jobs.forEach((job, index) => {
        const [actualWidth, actualHeight] = dimensions[index].split('|').map(Number);
        if (actualWidth !== job.width || actualHeight !== job.height) {
            throw new Error(`${job.mapId}: map data declares ${job.width}x${job.height}, but ${job.imageUrl} is ${actualWidth}x${actualHeight}.`);
        }
    });
}

function renderTileLevel(job, level, mapOutputDir, options) {
    const levelTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `map-hiraeth-tiles-${job.mapId}-${level.z}-`));

    try {
        runMagick(
            buildTileMagickArgs(job, level, levelTmpDir, { repoRoot: options.repoRoot }),
            `${job.mapId} z${level.z}`,
            options.magickBinary
        );

        let sequenceIndex = 0;
        for (let y = 0; y < level.rows; y += 1) {
            for (let x = 0; x < level.columns; x += 1) {
                const generatedName = `tile-${String(sequenceIndex).padStart(6, '0')}.webp`;
                const generatedPath = path.join(levelTmpDir, generatedName);
                if (!fs.existsSync(generatedPath)) {
                    throw new Error(`${job.mapId} z${level.z}: missing generated tile ${generatedName}`);
                }
                const tileDestination = path.join(mapOutputDir, String(level.z), String(x), `${y}.webp`);
                fs.mkdirSync(path.dirname(tileDestination), { recursive: true });
                fs.renameSync(generatedPath, tileDestination);
                sequenceIndex += 1;
            }
        }
    } finally {
        fs.rmSync(levelTmpDir, { recursive: true, force: true });
    }
}

function shouldSkipTileGeneration() {
    return /^(1|true|yes)$/i.test(String(process.env.MAP_HIRAETH_SKIP_TILES || '').trim());
}

function createTileManifestMap(job, fingerprint) {
    return {
        id: job.mapId,
        name: job.name,
        width: job.width,
        height: job.height,
        imageUrl: job.imageUrl,
        rendererVersion: tileRendererVersion,
        fingerprint,
        cacheVersion: getTileCacheVersion(fingerprint),
        tileSource: {
            type: job.tileSource.type,
            urlTemplate: job.tileSource.urlTemplate,
            tileSize: job.tileSource.tileSize,
            minZoom: job.tileSource.minZoom,
            maxZoom: job.tileSource.maxZoom,
            overviewQuality: job.tileSource.overviewQuality,
            quality: job.tileSource.quality
        },
        levels: job.levels.map(({ z, columns, rows, tileCount, scaledWidth, scaledHeight }) => ({
            z,
            columns,
            rows,
            tileCount,
            scaledWidth,
            scaledHeight,
            quality: getTileLevelQuality(job.tileSource, { z })
        })),
        totalTiles: job.totalTiles
    };
}

function getComparableManifestMap(manifestMap) {
    if (!isObject(manifestMap)) return null;
    return {
        id: manifestMap.id,
        width: manifestMap.width,
        height: manifestMap.height,
        imageUrl: manifestMap.imageUrl,
        tileSource: manifestMap.tileSource,
        levels: manifestMap.levels,
        totalTiles: manifestMap.totalTiles
    };
}

function isCachedTileMapReusable(outputDir, job, cachedMap, fingerprint = getTileJobFingerprint(job)) {
    if (!isObject(cachedMap)) return false;
    if (cachedMap.fingerprint !== fingerprint) return false;

    const expectedMap = createTileManifestMap(job, fingerprint);
    if (JSON.stringify(getComparableManifestMap(cachedMap)) !== JSON.stringify(getComparableManifestMap(expectedMap))) {
        return false;
    }

    const mapOutputDir = resolveSafeOutputPath(outputDir, job.mapId);
    for (const level of job.levels) {
        for (let y = 0; y < level.rows; y += 1) {
            for (let x = 0; x < level.columns; x += 1) {
                const tilePath = path.join(mapOutputDir, String(level.z), String(x), `${y}.webp`);
                try {
                    const tileStat = fs.statSync(tilePath);
                    if (!tileStat.isFile() || tileStat.size <= 0) return false;
                } catch (error) {
                    return false;
                }
            }
        }
    }
    return true;
}

function readExistingTileManifest(outputDir) {
    const manifestPath = path.join(outputDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return Array.isArray(manifest.maps) ? manifest : null;
    } catch (error) {
        return null;
    }
}

function generateTiles(options = {}) {
    const root = path.resolve(options.repoRoot || repoRoot);
    const outputDir = path.resolve(options.outputDir || path.join(root, 'dist', 'tile'));
    const logger = options.logger || console;

    if (shouldSkipTileGeneration()) {
        logger.log('Skipping map tile generation because MAP_HIRAETH_SKIP_TILES is set.');
        return { skipped: true, outputDir, maps: [], totalTiles: 0 };
    }

    const requestedMapIds = Array.isArray(options.mapIds) && options.mapIds.length > 0
        ? new Set(options.mapIds.map((mapId) => String(mapId).trim()).filter(Boolean))
        : null;
    const jobs = collectTileJobs(root).filter((job) => !requestedMapIds || requestedMapIds.has(job.mapId));
    jobs.forEach((job) => {
        if (!fs.existsSync(job.sourceImagePath)) {
            throw new Error(`${job.mapId}: missing source image ${job.imageUrl}`);
        }
    });

    const reuseExisting = options.reuseExisting === true;
    const existingManifest = reuseExisting ? readExistingTileManifest(outputDir) : null;
    const cachedMapsById = new Map(
        (existingManifest?.maps || []).map((manifestMap) => [String(manifestMap?.id || ''), manifestMap])
    );
    if (!reuseExisting) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    const preparedJobs = jobs.map((job) => {
        const fingerprint = getTileJobFingerprint(job);
        const cachedMap = cachedMapsById.get(job.mapId);
        return {
            job,
            fingerprint,
            reusable: reuseExisting && isCachedTileMapReusable(outputDir, job, cachedMap, fingerprint)
        };
    });
    const jobsToGenerate = preparedJobs.filter((preparedJob) => !preparedJob.reusable);
    const jobsToValidate = options.validateSourceDimensions !== false
        ? jobsToGenerate.map((preparedJob) => preparedJob.job)
        : [];
    const magickBinary = jobsToGenerate.length > 0
        ? resolveImageMagickBinary({ preferredBinary: options.magickBinary ?? process.env.MAGICK_BINARY })
        : '';
    if (jobsToValidate.length > 0) {
        validateTileSourceDimensions(jobsToValidate, { magickBinary, repoRoot: root });
    }

    if (reuseExisting) {
        const activeMapIds = new Set(jobs.map((job) => job.mapId));
        fs.readdirSync(outputDir, { withFileTypes: true }).forEach((entry) => {
            if (entry.isDirectory() && !activeMapIds.has(entry.name)) {
                fs.rmSync(resolveSafeOutputPath(outputDir, entry.name), { recursive: true, force: true });
            }
        });
    }

    const generatedMaps = [];
    let totalTiles = 0;
    let reusedMapCount = 0;
    let reusedTileCount = 0;
    preparedJobs.forEach(({ job, fingerprint, reusable }) => {
        const mapOutputDir = resolveSafeOutputPath(outputDir, job.mapId);
        if (reusable) {
            reusedMapCount += 1;
            reusedTileCount += job.totalTiles;
        } else {
            fs.rmSync(mapOutputDir, { recursive: true, force: true });
            fs.mkdirSync(mapOutputDir, { recursive: true });
            job.levels.forEach((level) => renderTileLevel(job, level, mapOutputDir, { magickBinary, repoRoot: root }));
            logger.log(`Generated ${job.totalTiles} tiles for ${job.mapId}.`);
        }
        totalTiles += job.totalTiles;
        generatedMaps.push(createTileManifestMap(job, fingerprint));
    });

    const fingerprint = getTileSetFingerprint(preparedJobs.map(({ job, fingerprint: jobFingerprint }) => ({
        mapId: job.mapId,
        fingerprint: jobFingerprint
    })));
    const manifest = {
        generatedAt: new Date().toISOString(),
        rendererVersion: tileRendererVersion,
        fingerprint,
        maps: generatedMaps,
        totalTiles
    };
    fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    if (reusedMapCount > 0) {
        logger.log(`Reused ${reusedMapCount} cached map tile sets (${reusedTileCount} tiles).`);
    }
    logger.log(`Prepared ${totalTiles} map tiles in ${path.relative(root, outputDir) || outputDir}.`);
    return {
        skipped: false,
        outputDir,
        maps: generatedMaps,
        totalTiles,
        fingerprint,
        reusedMaps: reusedMapCount,
        generatedMaps: jobsToGenerate.length
    };
}

if (require.main === module) {
    try {
        if (process.argv.includes('--print-cache-key')) {
            console.log(getTileBuildFingerprint());
        } else {
            generateTiles();
        }
    } catch (error) {
        console.error(error.message || error);
        process.exit(1);
    }
}

module.exports = {
    buildTileMagickArgs,
    collectTileJobs,
    computeTileLevelPlan,
    createTileManifestMap,
    generateTiles,
    getTileBuildFingerprint,
    getTileCacheVersion,
    getTileJobFingerprint,
    getTileLevelQuality,
    isCachedTileMapReusable,
    normalizeTileSource,
    resolveImageMagickBinary,
    tileRendererVersion,
    validateTileSourceDimensions
};
