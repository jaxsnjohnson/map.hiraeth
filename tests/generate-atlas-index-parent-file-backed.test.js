const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { generateAtlasIndex } = require('../scripts/generate_atlas_index.js');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-gen-parent-'));
const mapsDir = path.join(tmpRoot, 'maps');

fs.mkdirSync(mapsDir, { recursive: true });

fs.writeFileSync(path.join(mapsDir, 'maps.json'), `${JSON.stringify([
    {
        id: 'continent-map',
        order: 0,
        group: 'Countries',
        dataUrl: 'maps/continent-map.json'
    },
    {
        id: 'harbor-map',
        parentId: 'continent-map',
        order: 0,
        category: 'Geographic Regions',
        dataUrl: 'maps/harbor-map.json'
    }
], null, 2)}\n`);

fs.writeFileSync(path.join(mapsDir, 'continent-map.json'), `${JSON.stringify({
    id: 'continent-map',
    name: 'Continent Map',
    type: 'folder',
    width: 500,
    height: 400,
    imageUrl: 'maps/continent-map.webp',
    blurb: 'A broad overview of the continent.',
    pointsOfInterest: [
        {
            name: 'Stone Circle',
            coords: [40, 80],
            type: 'Landmark'
        }
    ],
    children: ['harbor-map']
}, null, 2)}\n`);

fs.writeFileSync(path.join(mapsDir, 'harbor-map.json'), `${JSON.stringify({
    id: 'harbor-map',
    name: 'Harbor Map',
    width: 100,
    height: 100,
    imageUrl: 'maps/harbor-map.webp',
    pointsOfInterest: [
        {
            name: 'Old Dock',
            coords: [10, 20],
            type: 'Harbor'
        }
    ]
}, null, 2)}\n`);

const result = generateAtlasIndex({ repoRoot: tmpRoot });
const atlas = result.atlasIndex;

const continent = atlas.tree.find((item) => item.id === 'continent-map');
assert.ok(continent);
assert.equal(continent.dataUrl, 'maps/continent-map.json');
assert.equal(continent.group, 'Countries');
assert.ok(Array.isArray(continent.children));
assert.equal(continent.children.length, 1);

const harbor = continent.children.find((item) => item.id === 'harbor-map');
assert.ok(harbor);
assert.equal(harbor.dataUrl, 'maps/harbor-map.json');
assert.equal(harbor.category, 'Geographic Regions');

const continentPoi = atlas.searchIndex.find((entry) => entry.kind === 'poi' && entry.mapId === 'continent-map');
assert.ok(continentPoi);
assert.equal(continentPoi.name, 'Stone Circle');

const harborPoi = atlas.searchIndex.find((entry) => entry.kind === 'poi' && entry.mapId === 'harbor-map');
assert.ok(harborPoi);
assert.equal(harborPoi.name, 'Old Dock');

console.log('generate_atlas_index parent file-backed fixture checks passed');
