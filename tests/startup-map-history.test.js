const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert.match(
    appSource,
    /async function loadMapData\(\) \{[\s\S]*initializeApp\(\);/,
    'loadMapData should initialize the app after atlas data is ready.'
);

assert.match(
    appSource,
    /function finalizeAppInitialization\(mapToLoadData, mapIdToLoad = ''\) \{[\s\S]*currentlyLoadedMapId \|\| String\(mapIdToLoad \|\| mapToLoadData\?\.id \|\| ''\)\.trim\(\);[\s\S]*history\.replaceState\(\{ mapId: loadedMapId,/,
    'startup history should preserve the selected map id before async map load completion.'
);

assert.match(
    appSource,
    /function initializeApp\(\) \{[\s\S]*loadMap\(mapIdToLoad, false\);[\s\S]*finalizeAppInitialization\(mapToLoadData, mapIdToLoad\);/,
    'initializeApp should pass the selected map id into startup history finalization.'
);

console.log('startup map history regression checks passed');
