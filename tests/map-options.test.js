const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert.match(appSource, /const mapOptions = \{[\s\S]*minZoom:\s*-4,/);
assert.match(appSource, /const mapOptions = \{[\s\S]*maxZoom:\s*4,/);
assert.match(appSource, /const SMOOTH_ZOOM_STEP = 0\.5;/);
assert.match(appSource, /const WHEEL_ZOOM_SNAP = 0;/);
assert.match(appSource, /const SMOOTH_WHEEL_ZOOM_SENSITIVITY = 0\.0024;/);
assert.match(appSource, /const SMOOTH_WHEEL_MAX_DELTA = 0\.45;/);
assert.match(appSource, /const SMOOTH_WHEEL_EASE = 0\.32;/);
assert.match(appSource, /const mapOptions = \{[\s\S]*zoomSnap:\s*WHEEL_ZOOM_SNAP,/);
assert.match(appSource, /const mapOptions = \{[\s\S]*zoomDelta:\s*SMOOTH_ZOOM_STEP,/);
assert.match(appSource, /const mapOptions = \{[\s\S]*scrollWheelZoom:\s*false,/);
assert.match(appSource, /function handleSmoothWheelZoom\(event\) \{[\s\S]*event\.preventDefault\(\);[\s\S]*scheduleSmoothWheelFrame\(\);/);
assert.match(appSource, /map\.getContainer\(\)\.addEventListener\('wheel', handleSmoothWheelZoom, \{ passive: false \}\);/);
assert.match(appSource, /function zoomMapBy\(delta\) \{[\s\S]*map\.setZoom\(map\.getZoom\(\) \+ delta, SMOOTH_ZOOM_OPTIONS\);/);

console.log('map options regression checks passed');
