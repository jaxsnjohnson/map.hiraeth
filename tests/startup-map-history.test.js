const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const styleSource = fs.readFileSync('css/style.css', 'utf8');

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
    /function mountBootstrapMapPreview\(mapInfo\) \{[\s\S]*const previewImageUrl = getMiniMapImageUrl\(mapInfo\);[\s\S]*previewImage\.fetchPriority = 'high';[\s\S]*document\.documentElement\.classList\.add\('bootstrap-map-preview-loading'\);/,
    'app-driven map loads should mount the low-resolution preview before detailed map pixels are ready.'
);

assert.match(
    appSource,
    /function initMapLoadContext\(mapId, preResolvedMap\) \{[\s\S]*const manifestEntry = preResolvedMap \|\| findMapRecursive\(mapData, requestedMapId\);[\s\S]*mountBootstrapMapPreview\(manifestEntry\);[\s\S]*setMapChooserVisible\(false\);/,
    'app-driven map loads should mount the preview before revealing the map shell.'
);

assert.match(
    appSource,
    /function finalizeMapLoadState\(requestedMapId, selectedMap, usingAlternateMobileImage, loadStartedAt, options = \{\}\) \{[\s\S]*loadingIndicator\.style\.display = 'none';[\s\S]*document\.documentElement\.classList\.remove\('bootstrap-map-preview-loading'\);/,
    'startup should hide the bootstrap preview loading bar before clearing its slim-bar state.'
);

assert.match(
    appSource,
    /function abortMapLoad\(options = \{\}\) \{[\s\S]*removeBootstrapMapPreview\(\);[\s\S]*document\.documentElement\.classList\.remove\('bootstrap-map-preview-loading'\);[\s\S]*setLoadingMessage\(message,/,
    'failed map loads should clear bootstrap preview loading mode before showing error text and retry controls.'
);

assert.match(
    styleSource,
    /html\.bootstrap-map-preview-loading #sidebar \{[\s\S]*width: 0 !important;[\s\S]*box-shadow: none !important;/,
    'startup should hide the sidebar while the bootstrap preview is loading.'
);

assert.match(
    appSource,
    /function startMapLoadingProgress\(manifestEntry\) \{[\s\S]*const isBootstrapPreviewLoading = hasBootstrapMapPreview\(\);[\s\S]*document\.documentElement\.classList\.add\('bootstrap-map-preview-loading'\);[\s\S]*setLoadingProgressValue\(isBootstrapPreviewLoading \? Math\.max\(loadingProgress, 45\) : 0\);/,
    'map loading progress should keep a non-blocking loading bar visible over the mounted bootstrap map preview.'
);

assert.match(
    appSource,
    /function finishPreviewLoading\(\) \{[\s\S]*removeBootstrapMapPreview\(\);[\s\S]*setLoadingProgressValue\(Math\.max\(loadingProgress, 60\)\);[\s\S]*\}/,
    'preview completion should keep the loading bar visible instead of finalizing the whole map load.'
);

assert.match(
    appSource,
    /function finishDetailLoading\(\) \{[\s\S]*const hadPreviewLayer = !!currentMapPreviewLayer;[\s\S]*const keepPreviewLayer = currentMapBaseLayerMode === 'tile' && tileLoadFailures > 0 && !!currentMapPreviewLayer;[\s\S]*if \(!keepPreviewLayer\) \{[\s\S]*removeMapPreviewLayer\(\);[\s\S]*hideDelayMs: hadPreviewLayer \? 0 : 300/,
    'detail completion should hide the loading bar immediately while preserving the preview behind failed tiles.'
);

assert.doesNotMatch(
    appSource,
    /previewReadyTimeout = setTimeout\(finish(?:Initial|Preview)Loading, 550\)/,
    'the 550ms preview timeout should not remove the only visible preview image.'
);

assert.match(
    appSource,
    /previewReadyTimeout = setTimeout\(\(\) => \{[\s\S]*setLoadingProgressValue\(Math\.max\(loadingProgress, 55\)\);[\s\S]*\}, 550\);/,
    'preview timeout should only advance progress while the mini image continues loading.'
);

assert.match(
    appSource,
    /console\.warn\('Detailed map image is still loading; keeping the preview visible\.'\);[\s\S]*setLoadingProgressValue\(Math\.max\(loadingProgress, 92\)\);/,
    'slow detail loading should keep the preview visible instead of hiding the loading state.'
);

assert.match(
    appSource,
    /let tileLoadFailures = 0;[\s\S]*currentImageLayer\.on\('tileerror', function \(event\) \{[\s\S]*tileLoadFailures \+= 1;[\s\S]*if \(currentMapPreviewLayer\) \{[\s\S]*keeping the low-resolution preview behind tiles[\s\S]*return;[\s\S]*falling back to full map image/,
    'tile errors should keep the mini preview instead of immediately downloading the full map image.'
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
