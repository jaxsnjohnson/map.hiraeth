#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

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
    'css/style.css',
    'css/stars.css',
    'css/Control.MiniMap.min.css',
    'js/app-config.js',
    'js/shared-utils.js',
    'js/starfield.js',
    'js/app.js',
    'js/libs/Control.MiniMap.min.js'
];

const runtimeDirectories = [
    'images',
    'maps',
    'sounds'
];

const forbiddenPublicFiles = [
    'map-editor.html',
    'js/map-editor.js',
    'js/editor-shared.js',
    'js/libs/text-toolbar.js',
    'css/map-editor.css',
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

    fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');
    assertForbiddenFilesAbsent();

    const copiedFileCount = countFiles(outputDir);
    console.log(`Built GitHub Pages bundle at dist/ with ${copiedFileCount} files.`);
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
    buildPagesBundle
};
