const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function findMapRecursive(items, id) {');
const fnEnd = appSource.indexOf('function parseHash() {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate findFirstLoadableIdRecursive function block in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);
// Evaluate production source so assertions stay coupled to real logic.
// eslint-disable-next-line no-eval
eval(fnSource);

const nestedMaps = [
    {
        id: 'folder-1',
        type: 'folder',
        children: [
            { id: 'coming-soon-map', status: 'coming-soon', width: 800, height: 600, imageUrl: 'maps/cs.webp' },
            { id: 'missing-image', width: 800, height: 600 },
            {
                id: 'folder-2',
                type: 'folder',
                children: [
                    { id: 'first-renderable', width: 1024, height: 768, imageUrl: 'maps/ok.webp' }
                ]
            }
        ]
    }
];
assert.equal(findFirstLoadableIdRecursive(nestedMaps), 'first-renderable');

const onlyComingSoon = [
    { id: 'soon-a', status: 'coming-soon', width: 100, height: 100, imageUrl: 'maps/a.webp' },
    {
        id: 'folder',
        type: 'folder',
        children: [
            { id: 'soon-b', status: 'coming-soon', width: 100, height: 100, imageUrl: 'maps/b.webp' }
        ]
    }
];
assert.equal(findFirstLoadableIdRecursive(onlyComingSoon), null);

const noRenderableEntries = [
    { id: 'folder-only', type: 'folder', children: [] },
    { id: 'bad-dimensions', width: 0, height: 200, imageUrl: 'maps/x.webp' },
    { id: 'no-image', width: 200, height: 200, imageUrl: '' }
];
assert.equal(findFirstLoadableIdRecursive(noRenderableEntries), null);

console.log('findFirstLoadableIdRecursive regression checks passed');
