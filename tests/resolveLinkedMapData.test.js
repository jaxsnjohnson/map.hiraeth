const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const mapFnsStart = appSource.indexOf('function findMapRecursive(items, id) {');
const mapFnsEnd = appSource.indexOf('function parseHash() {');
const linkedFnStart = appSource.indexOf('function resolveLinkedMapData(featureData) {');
const linkedFnEnd = appSource.indexOf('// --- NEW: Unified Popup Content Generator ---');

if (
    mapFnsStart === -1 || mapFnsEnd === -1 || mapFnsEnd <= mapFnsStart ||
    linkedFnStart === -1 || linkedFnEnd === -1 || linkedFnEnd <= linkedFnStart
) {
    throw new Error('Could not locate resolveLinkedMapData dependencies in js/app.js');
}

const mapFnsSource = appSource.slice(mapFnsStart, mapFnsEnd);
const linkedFnSource = appSource.slice(linkedFnStart, linkedFnEnd);
let mapData = [];
// Evaluate production sources so assertions track real behavior.
// eslint-disable-next-line no-eval
eval(mapFnsSource);
// eslint-disable-next-line no-eval
eval(linkedFnSource);

mapData = [
    { id: 'folder-like', type: 'folder', children: [] },
    { id: 'coming-soon-map', status: 'coming-soon', width: 100, height: 100, imageUrl: 'maps/soon.webp' },
    { id: 'renderable-map', name: 'Renderable Map', width: 1200, height: 900, imageUrl: 'maps/live.webp' }
];

assert.equal(resolveLinkedMapData({ linkedMapId: 'folder-like' }), null);
assert.equal(resolveLinkedMapData({ linkedMapId: 'coming-soon-map' }), null);
assert.deepEqual(resolveLinkedMapData({ linkedMapId: 'renderable-map' }), {
    id: 'renderable-map',
    name: 'Renderable Map'
});

console.log('resolveLinkedMapData regression checks passed');
