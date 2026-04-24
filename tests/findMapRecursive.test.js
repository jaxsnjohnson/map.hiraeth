const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function findMapRecursive(items, id) {');
const fnEnd = appSource.indexOf('function isRenderableMapEntry(item) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate findMapRecursive function block in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);
// Evaluate production source so assertions stay coupled to real logic.
// eslint-disable-next-line no-eval
eval(fnSource);

// Test finding a map at the top level
const topLevelMap = [{ id: 'map-1', name: 'Map 1' }, { id: 'map-2', name: 'Map 2' }];
assert.deepEqual(findMapRecursive(topLevelMap, 'map-1'), { id: 'map-1', name: 'Map 1' });
assert.deepEqual(findMapRecursive(topLevelMap, 'map-2'), { id: 'map-2', name: 'Map 2' });

// Test finding a map nested inside a folder
const nestedMaps = [
    {
        id: 'folder-1',
        type: 'folder',
        children: [
            { id: 'map-3', name: 'Map 3' },
            {
                id: 'folder-2',
                type: 'folder',
                children: [
                    { id: 'map-4', name: 'Map 4' }
                ]
            }
        ]
    }
];
assert.deepEqual(findMapRecursive(nestedMaps, 'map-3'), { id: 'map-3', name: 'Map 3' });
assert.deepEqual(findMapRecursive(nestedMaps, 'map-4'), { id: 'map-4', name: 'Map 4' });
// Test finding a folder itself
assert.deepEqual(findMapRecursive(nestedMaps, 'folder-2'), {
    id: 'folder-2',
    type: 'folder',
    children: [ { id: 'map-4', name: 'Map 4' } ]
});

// Test when map is not found
assert.equal(findMapRecursive(topLevelMap, 'non-existent'), null);
assert.equal(findMapRecursive(nestedMaps, 'non-existent'), null);

// Test with empty arrays or missing children
assert.equal(findMapRecursive([], 'map-1'), null);
const emptyFolder = [{ id: 'folder-empty', type: 'folder', children: [] }];
assert.equal(findMapRecursive(emptyFolder, 'map-1'), null);

// Test missing type field but has children (should not recurse based on existing logic which requires item.type === 'folder')
const badFolder = [{ id: 'bad-folder', children: [{ id: 'hidden-map' }] }];
assert.equal(findMapRecursive(badFolder, 'hidden-map'), null);

console.log('findMapRecursive checks passed');
