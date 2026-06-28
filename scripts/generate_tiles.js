#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const defaultTileSize = 256;
const defaultQuality = 82;
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

    return {
        type,
        urlTemplate,
        tileSize,
        minZoom,
        maxZoom,
        quality: toPositiveInteger(tileSource.quality, defaultQuality)
    };
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
        '-quality',
        String(job.tileSource.quality),
        formatMagickImagePath(outputPattern, `${job.mapId} z${level.z} output pattern`, levelTmpDir)
    ];
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
    const magickBinary = jobs.length > 0
        ? resolveImageMagickBinary({ preferredBinary: options.magickBinary ?? process.env.MAGICK_BINARY })
        : '';

    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });

    const generatedMaps = [];
    let totalTiles = 0;
    jobs.forEach((job) => {
        if (!fs.existsSync(job.sourceImagePath)) {
            throw new Error(`${job.mapId}: missing source image ${job.imageUrl}`);
        }
        const mapOutputDir = resolveSafeOutputPath(outputDir, job.mapId);
        fs.rmSync(mapOutputDir, { recursive: true, force: true });
        fs.mkdirSync(mapOutputDir, { recursive: true });
        job.levels.forEach((level) => renderTileLevel(job, level, mapOutputDir, { magickBinary, repoRoot: root }));
        totalTiles += job.totalTiles;
        generatedMaps.push({
            id: job.mapId,
            name: job.name,
            width: job.width,
            height: job.height,
            imageUrl: job.imageUrl,
            tileSource: {
                type: job.tileSource.type,
                urlTemplate: job.tileSource.urlTemplate,
                tileSize: job.tileSource.tileSize,
                minZoom: job.tileSource.minZoom,
                maxZoom: job.tileSource.maxZoom
            },
            levels: job.levels.map(({ z, columns, rows, tileCount, scaledWidth, scaledHeight }) => ({
                z,
                columns,
                rows,
                tileCount,
                scaledWidth,
                scaledHeight
            })),
            totalTiles: job.totalTiles
        });
        logger.log(`Generated ${job.totalTiles} tiles for ${job.mapId}.`);
    });

    const manifest = {
        generatedAt: new Date().toISOString(),
        maps: generatedMaps,
        totalTiles
    };
    fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    logger.log(`Generated ${totalTiles} map tiles in ${path.relative(root, outputDir) || outputDir}.`);
    return { skipped: false, outputDir, maps: generatedMaps, totalTiles };
}

if (require.main === module) {
    try {
        generateTiles();
    } catch (error) {
        console.error(error.message || error);
        process.exit(1);
    }
}

module.exports = {
    buildTileMagickArgs,
    collectTileJobs,
    computeTileLevelPlan,
    generateTiles,
    normalizeTileSource,
    resolveImageMagickBinary
};
