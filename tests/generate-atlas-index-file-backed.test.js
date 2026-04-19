const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { generateAtlasIndex } = require('../scripts/generate_atlas_index.js');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-gen-'));
const mapsDir = path.join(tmpRoot, 'maps');
const generatedDir = path.join(mapsDir, 'generated');

fs.mkdirSync(generatedDir, { recursive: true });

fs.writeFileSync(path.join(mapsDir, 'maps.json'), `${JSON.stringify([
    {
        id: 'folder-root',
        name: 'Root',
        type: 'folder',
        order: 0
    },
    {
        id: 'file-backed-map',
        parentId: 'folder-root',
        order: 0,
        dataUrl: 'maps/file-backed-map.json',
        name: 'File Backed'
    },
    {
        id: 'inline-map',
        parentId: 'folder-root',
        order: 1,
        name: 'Inline Map',
        width: 100,
        height: 100,
        imageUrl: 'maps/inline-map.webp',
        pointsOfInterest: [
            {
                name: 'Inline POI',
                coords: [1, 2],
                type: 'Point of Interest'
            }
        ]
    }
], null, 2)}\n`);

fs.writeFileSync(path.join(mapsDir, 'file-backed-map.json'), `${JSON.stringify({
    id: 'file-backed-map',
    name: 'File Backed Source',
    width: 100,
    height: 100,
    imageUrl: 'maps/file-backed-map.webp',
    pointsOfInterest: [
        {
            name: 'File POI',
            coords: [10, 20],
            type: 'Landmark'
        }
    ]
}, null, 2)}\n`);

fs.writeFileSync(path.join(mapsDir, 'unreferenced-map.json'), `${JSON.stringify({
    id: 'unreferenced-map',
    name: 'Ignored Map',
    width: 50,
    height: 50,
    imageUrl: 'maps/unreferenced-map.webp',
    pointsOfInterest: [
        {
            name: 'Should Not Appear',
            coords: [0, 0],
            type: 'Point of Interest'
        }
    ]
}, null, 2)}\n`);

const result = generateAtlasIndex({ repoRoot: tmpRoot });
const atlas = result.atlasIndex;

const folder = atlas.tree.find((item) => item.id === 'folder-root');
assert.ok(folder);

const fileBacked = folder.children.find((item) => item.id === 'file-backed-map');
assert.ok(fileBacked);
assert.equal(fileBacked.dataUrl, 'maps/file-backed-map.json');

const inlineMap = folder.children.find((item) => item.id === 'inline-map');
assert.ok(inlineMap);
assert.equal(inlineMap.dataUrl, 'maps/generated/inline-map.json');
assert.ok(fs.existsSync(path.join(mapsDir, 'generated', 'inline-map.json')));

const filePoi = atlas.searchIndex.find((entry) => entry.kind === 'poi' && entry.mapId === 'file-backed-map');
assert.ok(filePoi);
assert.equal(filePoi.name, 'File POI');

const ignored = atlas.searchIndex.find((entry) => entry.mapId === 'unreferenced-map');
assert.equal(ignored, undefined);

console.log('generate_atlas_index file-backed fixture checks passed');
