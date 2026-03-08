const assert = require('node:assert/strict');
const fs = require('node:fs');

const atlas = JSON.parse(fs.readFileSync('maps/atlas-index.json', 'utf8'));

assert.ok(Array.isArray(atlas.tree));
assert.ok(atlas.tree.length > 0);
assert.ok(Array.isArray(atlas.searchIndex));
assert.ok(atlas.searchIndex.length > 0);

const mainContinent = atlas.tree.find((item) => item.id === 'main_continent');
assert.ok(mainContinent);
assert.equal(mainContinent.dataUrl, 'maps/generated/main_continent.json');
assert.ok(Array.isArray(mainContinent.children));
assert.ok(mainContinent.children.length > 0);

const mapSearchEntry = atlas.searchIndex.find((entry) => entry.kind === 'map' && entry.mapId === 'main_continent');
assert.ok(mapSearchEntry);
assert.equal(mapSearchEntry.name, 'Content Map');

const poiSearchEntry = atlas.searchIndex.find((entry) => entry.kind === 'poi');
assert.ok(poiSearchEntry);
assert.ok(poiSearchEntry.mapId);
assert.ok(poiSearchEntry.name);

console.log('atlas-index regression checks passed');
