const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert.match(appSource, /const mapOptions = \{[\s\S]*minZoom:\s*-4,/);
assert.match(appSource, /const mapOptions = \{[\s\S]*maxZoom:\s*4,/);
assert.match(appSource, /const SMOOTH_ZOOM_STEP = 0\.5;/);
assert.match(appSource, /const mapOptions = \{[\s\S]*zoomSnap:\s*0\.25,/);
assert.match(appSource, /const mapOptions = \{[\s\S]*zoomDelta:\s*SMOOTH_ZOOM_STEP,/);
assert.match(appSource, /const mapOptions = \{[\s\S]*wheelPxPerZoomLevel:\s*120,/);
assert.match(appSource, /const mapOptions = \{[\s\S]*wheelDebounceTime:\s*16,/);
assert.match(appSource, /function zoomMapBy\(delta\) \{[\s\S]*map\.setZoom\(map\.getZoom\(\) \+ delta, SMOOTH_ZOOM_OPTIONS\);/);

console.log('map options regression checks passed');
