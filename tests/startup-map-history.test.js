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
    /function hasBootstrapMapPreview\(\) \{[\s\S]*document\.getElementById\('map-bootstrap-preview'\)/,
    'startup should treat a mounted bootstrap map preview as the first loading state.'
);

assert.match(
    appSource,
    /function startMapLoadingProgress\(manifestEntry\) \{[\s\S]*if \(hasBootstrapMapPreview\(\)\) return;[\s\S]*loadingIndicator\.style\.display = 'flex';/,
    'map loading progress should not cover the mounted bootstrap map preview.'
);

assert.match(
    appSource,
    /async function loadMapData\(\) \{[\s\S]*if \(loadingIndicator && !hasBootstrapMapPreview\(\)\) \{/,
    'loadMapData should not re-show the loader while the bootstrap map preview is mounted.'
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
