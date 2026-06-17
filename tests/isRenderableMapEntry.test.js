const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function isRenderableMapEntry(item) {');
const fnEnd = appSource.indexOf('function findFirstLoadableIdRecursive(items) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate isRenderableMapEntry function block in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);
// Evaluate production source so assertions stay coupled to real logic.
// eslint-disable-next-line no-eval
eval(fnSource);

// Valid item
assert.equal(isRenderableMapEntry({ id: 'map1', width: 800, height: 600, imageUrl: 'maps/map1.webp' }), true);
assert.equal(isRenderableMapEntry({ id: 'map1', width: '800', height: '600', imageUrl: ' maps/map1.webp ' }), true);

// Invalid type
assert.equal(isRenderableMapEntry(null), false);
assert.equal(isRenderableMapEntry(undefined), false);
assert.equal(isRenderableMapEntry('string'), false);
assert.equal(isRenderableMapEntry(123), false);

// Status coming-soon
assert.equal(isRenderableMapEntry({ id: 'map1', status: 'coming-soon', width: 800, height: 600, imageUrl: 'maps/map1.webp' }), false);

// Missing or empty ID
assert.equal(isRenderableMapEntry({ width: 800, height: 600, imageUrl: 'maps/map1.webp' }), false);
assert.equal(isRenderableMapEntry({ id: '', width: 800, height: 600, imageUrl: 'maps/map1.webp' }), false);
assert.equal(isRenderableMapEntry({ id: '   ', width: 800, height: 600, imageUrl: 'maps/map1.webp' }), false);

// Invalid width
assert.equal(isRenderableMapEntry({ id: 'map1', width: 0, height: 600, imageUrl: 'maps/map1.webp' }), false);
assert.equal(isRenderableMapEntry({ id: 'map1', width: -10, height: 600, imageUrl: 'maps/map1.webp' }), false);
assert.equal(isRenderableMapEntry({ id: 'map1', width: NaN, height: 600, imageUrl: 'maps/map1.webp' }), false);
assert.equal(isRenderableMapEntry({ id: 'map1', height: 600, imageUrl: 'maps/map1.webp' }), false); // missing width

// Invalid height
assert.equal(isRenderableMapEntry({ id: 'map1', width: 800, height: 0, imageUrl: 'maps/map1.webp' }), false);
assert.equal(isRenderableMapEntry({ id: 'map1', width: 800, height: -10, imageUrl: 'maps/map1.webp' }), false);
assert.equal(isRenderableMapEntry({ id: 'map1', width: 800, height: NaN, imageUrl: 'maps/map1.webp' }), false);
assert.equal(isRenderableMapEntry({ id: 'map1', width: 800, imageUrl: 'maps/map1.webp' }), false); // missing height

// Missing or empty imageUrl
assert.equal(isRenderableMapEntry({ id: 'map1', width: 800, height: 600 }), false);
assert.equal(isRenderableMapEntry({ id: 'map1', width: 800, height: 600, imageUrl: '' }), false);
assert.equal(isRenderableMapEntry({ id: 'map1', width: 800, height: 600, imageUrl: '   ' }), false);

console.log('isRenderableMapEntry tests passed');
