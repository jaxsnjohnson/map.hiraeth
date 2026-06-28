const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const viewportStart = appSource.indexOf('function resolveInitialMapViewport(params) {');
const popupStart = appSource.indexOf('// --- NEW: Unified Popup Content Generator ---');

if (viewportStart === -1 || popupStart === -1 || popupStart <= viewportStart) {
    throw new Error('Could not locate resolveInitialMapViewport in js/app.js');
}

const viewportSource = appSource.slice(viewportStart, popupStart);

// eslint-disable-next-line no-eval
eval(viewportSource);

let result = resolveInitialMapViewport(new URLSearchParams(''));
assert.deepEqual(result, { mode: 'fit-bounds' });

result = resolveInitialMapViewport(new URLSearchParams('view=11.5,22.25,3'));
assert.deepEqual(result, {
    mode: 'explicit-view',
    view: { lat: 11.5, lng: 22.25, zoom: 3 },
    rawView: '11.5,22.25,3'
});

result = resolveInitialMapViewport(new URLSearchParams('poi=Old%20Dock'));
assert.deepEqual(result, { mode: 'feature' });

result = resolveInitialMapViewport(new URLSearchParams('region=Northlands'));
assert.deepEqual(result, { mode: 'feature' });

result = resolveInitialMapViewport(new URLSearchParams('line=King%27s%20Road'));
assert.deepEqual(result, { mode: 'feature' });

result = resolveInitialMapViewport(new URLSearchParams('view=bad,data'));
assert.deepEqual(result, { mode: 'fit-bounds' });

console.log('resolveInitialMapViewport regression checks passed');
