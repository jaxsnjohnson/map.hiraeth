const assert = require('node:assert/strict');
const fs = require('node:fs');

const atlas = JSON.parse(fs.readFileSync('maps/atlas-index.json', 'utf8'));
const stomionSource = JSON.parse(fs.readFileSync('maps/The-Port-City-of-Stomion.json', 'utf8'));

assert.ok(Array.isArray(atlas.tree));
assert.ok(atlas.tree.length > 0);
assert.ok(Array.isArray(atlas.searchIndex));
assert.ok(atlas.searchIndex.length > 0);

const mainContinent = atlas.tree.find((item) => item.id === 'main_continent');
assert.ok(mainContinent);
assert.equal(mainContinent.dataUrl, 'maps/Fair-Content.json');
assert.ok(Array.isArray(mainContinent.children));
assert.ok(mainContinent.children.length > 0);

const iceBeach = mainContinent.children.find((item) => item.id === 'IceBeach');
assert.ok(iceBeach);
assert.equal(iceBeach.dataUrl, 'maps/IceBeach.json');

const stomion = mainContinent.children.find((item) => item.id === 'The-Port-City-of-Stomion');
assert.ok(stomion);
assert.equal(stomion.dataUrl, 'maps/The-Port-City-of-Stomion.json');

const mapSearchEntry = atlas.searchIndex.find((entry) => entry.kind === 'map' && entry.mapId === 'main_continent');
assert.ok(mapSearchEntry);
assert.equal(mapSearchEntry.name, 'Fair');

const stomionPoiEntry = atlas.searchIndex.find((entry) => entry.kind === 'poi' && entry.mapId === 'The-Port-City-of-Stomion');
assert.ok(stomionPoiEntry);
assert.equal(stomionPoiEntry.name, stomionSource.pointsOfInterest[0].name);

console.log('atlas-index regression checks passed');
