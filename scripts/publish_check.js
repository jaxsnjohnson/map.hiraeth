#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { countFiles, forbiddenPublicFiles } = require('./build_pages.js');

const repoRoot = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runStep(label, command, args) {
    console.log(`\n> ${label}`);
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        stdio: 'inherit'
    });
    if (result.error) {
        console.error(result.error.message || result.error);
        process.exit(1);
    }
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

function runCapture(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: 'pipe'
    });
    if (result.error || result.status !== 0) return null;
    return String(result.stdout || '').trim();
}

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function assertForbiddenFilesAbsent() {
    const present = forbiddenPublicFiles.filter((relativePath) => {
        return fs.existsSync(path.join(repoRoot, 'dist', relativePath));
    });
    if (present.length > 0) {
        console.error(`Forbidden editor/internal files found in dist/: ${present.join(', ')}`);
        process.exit(1);
    }
}

function printChangedFileSummary() {
    const status = runCapture('git', ['status', '--short', '--untracked-files=normal']);
    console.log('\nChanged files:');
    if (!status) {
        console.log('  Unable to read git status.');
        return;
    }
    const lines = status.split('\n').filter(Boolean);
    if (lines.length === 0) {
        console.log('  None');
        return;
    }
    lines.forEach((line) => console.log(`  ${line}`));
}

runStep('Generate atlas index', process.execPath, ['scripts/generate_atlas_index.js']);
runStep('Validate map data', process.execPath, ['scripts/validate_map_data.js']);
runStep('Run unit tests', npmCommand, ['run', 'test:unit']);
runStep('Build GitHub Pages bundle', process.execPath, ['scripts/build_pages.js']);
assertForbiddenFilesAbsent();

const atlas = readJson('maps/atlas-index.json');
const distPath = path.join(repoRoot, 'dist');
const distFileCount = fs.existsSync(distPath) ? countFiles(distPath) : 0;

console.log('\nPublish check passed.');
console.log(`- Search entries: ${Array.isArray(atlas.searchIndex) ? atlas.searchIndex.length : 0}`);
console.log(`- Pages bundle files: ${distFileCount}`);
console.log('- Forbidden editor/internal files absent from dist/');
printChangedFileSummary();
