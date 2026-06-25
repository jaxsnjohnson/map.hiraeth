#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { countFiles } = require('./build_pages.js');

const repoRoot = path.resolve(__dirname, '..');

function runGit(args) {
    const result = spawnSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: 'pipe'
    });
    if (result.error || result.status !== 0) return '';
    return String(result.stdout || '').trim();
}

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function getChangedMapFiles() {
    const baseSha = String(process.env.PAGES_SUMMARY_BASE_SHA || '').trim();
    const args = baseSha
        ? ['diff', '--name-only', baseSha, 'HEAD', '--', 'maps']
        : ['diff', '--name-only', 'HEAD^', 'HEAD', '--', 'maps'];
    return runGit(args)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && line !== 'maps/atlas-index.json');
}

const atlas = readJson('maps/atlas-index.json');
const distPath = path.join(repoRoot, 'dist');
const distFileCount = fs.existsSync(distPath) ? countFiles(distPath) : 0;
const changedMaps = getChangedMapFiles();
const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}#artifacts`
    : '';

console.log('## Pages Build Summary');
console.log('');
console.log(`- Search entries: ${Array.isArray(atlas.searchIndex) ? atlas.searchIndex.length : 0}`);
console.log(`- Bundle files: ${distFileCount}`);
console.log(`- Changed map files: ${changedMaps.length ? changedMaps.join(', ') : 'None'}`);
if (runUrl) {
    console.log(`- Artifact: [pages-static-bundle](${runUrl})`);
} else {
    console.log('- Artifact: pages-static-bundle');
}
