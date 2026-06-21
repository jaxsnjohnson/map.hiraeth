#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { generateTiles } = require('./generate_tiles.js');

const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'dist');

const runtimeFiles = [
    'index.html',
    'CNAME',
    'site.config.json',
    'sw.js',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon.png',
    'apple-touch-icon.png'
];

const runtimeAssetFiles = [
    'css/leaflet.css',
    'css/style.css',
    'css/stars.css',
    'css/Control.MiniMap.min.css',
    'css/images/marker-icon.png',
    'css/images/marker-icon-2x.png',
    'css/images/marker-shadow.png',
    'js/app-config.js',
    'js/shared-utils.js',
    'js/libs/leaflet.js',
    'js/libs/purify.min.js',
    'js/libs/lucide.min.js',
    'js/starfield.js',
    'js/app.js',
    'js/libs/Control.MiniMap.min.js'
];

const runtimeDirectories = [
    'images',
    'sounds'
];

const forbiddenPublicFiles = [
    'map-editor.html',
    'js/map-editor.js',
    'js/editor-shared.js',
    'js/libs/text-toolbar.js',
    'css/map-editor.css',
    'maps/maps.json',
    'tests',
    'scripts',
    'node_modules'
];

const ignoredAssetFileNames = new Set([
    '.DS_Store'
]);

function resolveRepoPath(relativePath) {
    const resolved = path.resolve(repoRoot, relativePath);
    if (!resolved.startsWith(`${repoRoot}${path.sep}`) && resolved !== repoRoot) {
        throw new Error(`Refusing to resolve path outside repository: ${relativePath}`);
    }
    return resolved;
}

function resolveOutputPath(relativePath) {
    const resolved = path.resolve(outputDir, relativePath);
    if (!resolved.startsWith(`${outputDir}${path.sep}`) && resolved !== outputDir) {
        throw new Error(`Refusing to write path outside dist: ${relativePath}`);
    }
    return resolved;
}

function assertExists(sourcePath, label) {
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Missing required Pages asset: ${label}`);
    }
}

function copyFile(relativePath) {
    const sourcePath = resolveRepoPath(relativePath);
    const destinationPath = resolveOutputPath(relativePath);
    assertExists(sourcePath, relativePath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
}

function copyDirectory(relativePath) {
    const sourcePath = resolveRepoPath(relativePath);
    const destinationPath = resolveOutputPath(relativePath);
    assertExists(sourcePath, relativePath);
    fs.cpSync(sourcePath, destinationPath, {
        recursive: true,
        filter: (source) => !ignoredAssetFileNames.has(path.basename(source))
    });
}

function isExternalUrl(value) {
    return /^https?:\/\//i.test(String(value || ''));
}

function normalizePublicAssetPath(assetPath) {
    const rawPath = String(assetPath || '').trim();
    if (!rawPath || isExternalUrl(rawPath) || rawPath.startsWith('#') || rawPath.startsWith('mailto:')) {
        return '';
    }

    const withoutHash = rawPath.split('#')[0];
    const withoutQuery = withoutHash.split('?')[0];
    if (!withoutQuery || path.isAbsolute(withoutQuery)) return '';

    const normalized = path.posix.normalize(withoutQuery);
    if (!normalized || normalized.startsWith('../') || normalized === '..' || path.isAbsolute(normalized)) {
        return '';
    }
    return normalized;
}

function addPublicAssetPath(assetPaths, assetPath, { optional = false } = {}) {
    const normalized = normalizePublicAssetPath(assetPath);
    if (!normalized) return;
    if (optional && !fs.existsSync(resolveRepoPath(normalized))) return;
    assetPaths.add(normalized);
}

function getDerivedMiniMapImagePath(imagePath) {
    const normalized = normalizePublicAssetPath(imagePath);
    if (!normalized) return '';
    const miniPath = normalized.replace(/(\.[^./?#]+)$/, '.mini.webp');
    return miniPath === normalized ? `${normalized}.mini.webp` : miniPath;
}

function addMapImageAssetPaths(assetPaths, mapLike) {
    if (!mapLike || typeof mapLike !== 'object') return;
    [
        'imageUrl',
        'mobileImageUrl',
        'imageUrlMobile',
        'smallImageUrl',
        'imageUrlSmall'
    ].forEach((key) => {
        const imagePath = mapLike[key];
        addPublicAssetPath(assetPaths, imagePath);
        addPublicAssetPath(assetPaths, getDerivedMiniMapImagePath(imagePath), { optional: true });
    });

    if (mapLike.imageVariants && typeof mapLike.imageVariants === 'object' && !Array.isArray(mapLike.imageVariants)) {
        Object.values(mapLike.imageVariants).forEach((variantValue) => {
            const imagePath = typeof variantValue === 'string' ? variantValue : variantValue?.url;
            addPublicAssetPath(assetPaths, imagePath);
            addPublicAssetPath(assetPaths, getDerivedMiniMapImagePath(imagePath), { optional: true });
        });
    }
}

function collectMapDocumentAssetPaths(assetPaths, dataUrl) {
    const normalizedDataUrl = normalizePublicAssetPath(dataUrl);
    if (!normalizedDataUrl) return;
    const mapDocumentPath = resolveRepoPath(normalizedDataUrl);
    if (!fs.existsSync(mapDocumentPath)) return;

    const mapDocument = JSON.parse(fs.readFileSync(mapDocumentPath, 'utf8'));
    addMapImageAssetPaths(assetPaths, mapDocument);
}

function collectPublicMapAssetFiles() {
    const atlasIndexPath = resolveRepoPath('maps/atlas-index.json');
    assertExists(atlasIndexPath, 'maps/atlas-index.json');

    const atlasIndex = JSON.parse(fs.readFileSync(atlasIndexPath, 'utf8'));
    const assetPaths = new Set(['maps/atlas-index.json']);

    function walkNode(node) {
        if (!node || typeof node !== 'object') return;
        addMapImageAssetPaths(assetPaths, node);

        const dataUrl = normalizePublicAssetPath(node.dataUrl);
        if (dataUrl) {
            addPublicAssetPath(assetPaths, dataUrl);
            collectMapDocumentAssetPaths(assetPaths, dataUrl);
        }

        if (Array.isArray(node.children)) {
            node.children.forEach(walkNode);
        }
    }

    if (Array.isArray(atlasIndex.tree)) {
        atlasIndex.tree.forEach(walkNode);
    }

    return Array.from(assetPaths).sort();
}

function copyPublicMapAssets() {
    collectPublicMapAssetFiles().forEach(copyFile);
}

function assertForbiddenFilesAbsent() {
    const presentForbiddenFiles = forbiddenPublicFiles.filter((relativePath) => {
        return fs.existsSync(resolveOutputPath(relativePath));
    });
    if (presentForbiddenFiles.length > 0) {
        throw new Error(`Forbidden internal files were copied to dist: ${presentForbiddenFiles.join(', ')}`);
    }
}

function buildPagesBundle() {
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });

    runtimeFiles.forEach(copyFile);
    runtimeAssetFiles.forEach(copyFile);
    runtimeDirectories.forEach(copyDirectory);
    copyPublicMapAssets();
    generateTiles({ repoRoot, outputDir: path.join(outputDir, 'tile') });

    fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');
    removeIgnoredAssetFiles(outputDir);
    assertForbiddenFilesAbsent();

    const copiedFileCount = countFiles(outputDir);
    console.log(`Built GitHub Pages bundle at dist/ with ${copiedFileCount} files.`);
}

function removeIgnoredAssetFiles(directoryPath) {
    if (!fs.existsSync(directoryPath)) return;
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    entries.forEach((entry) => {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            removeIgnoredAssetFiles(entryPath);
            return;
        }
        if (entry.isFile() && ignoredAssetFileNames.has(entry.name)) {
            fs.rmSync(entryPath, { force: true });
        }
    });
}

function countFiles(directoryPath) {
    let count = 0;
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    entries.forEach((entry) => {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            count += countFiles(entryPath);
        } else if (entry.isFile()) {
            count += 1;
        }
    });
    return count;
}

if (require.main === module) {
    try {
        buildPagesBundle();
    } catch (error) {
        console.error(error.message || error);
        process.exit(1);
    }
}

module.exports = {
    buildPagesBundle,
    collectPublicMapAssetFiles
};
