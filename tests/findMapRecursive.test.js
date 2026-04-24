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

const testTree = [
    {
        id: 'map-1',
        name: 'Map 1'
    },
    {
        id: 'folder-1',
        type: 'folder',
        children: [
            {
                id: 'map-2',
                name: 'Map 2'
            },
            {
                id: 'folder-2',
                type: 'folder',
                children: [
                    {
                        id: 'map-3',
                        name: 'Map 3'
                    }
                ]
            }
        ]
    }
];

// Find item at root level
assert.deepEqual(findMapRecursive(testTree, 'map-1'), testTree[0]);

// Find item in first level folder
assert.deepEqual(findMapRecursive(testTree, 'map-2'), testTree[1].children[0]);

// Find item in nested folder
assert.deepEqual(findMapRecursive(testTree, 'map-3'), testTree[1].children[1].children[0]);

// Find folder itself
assert.deepEqual(findMapRecursive(testTree, 'folder-2'), testTree[1].children[1]);

// Return null for non-existent id
assert.equal(findMapRecursive(testTree, 'non-existent'), null);

// Empty array
assert.equal(findMapRecursive([], 'map-1'), null);

console.log('findMapRecursive regression checks passed');
