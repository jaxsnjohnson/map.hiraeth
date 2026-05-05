const assert = require('node:assert/strict');
const fs = require('node:fs');

// Extract the updateCoordinates helper from production source.
const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function getMapPixelDimensions(');
const fnEnd = appSource.indexOf('// --- Map Click Handler ---');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate coordinate helper function block in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

// Set up the globals the function expects.
global.coordsLocked = false;
global.currentLatLonBounds = {
    north: 73,
    south: 1.24,
    east: -48.34375,
    west: 71.65625
};
// currentBounds is [[yMin, xMin], [yMax, xMax]] where y measures pixel height.
global.currentBounds = [[0, 0], [6144, 8192]];

let lastLatLon = null;
global.lockedCoords = null;
global.updateCoordinateDisplay = (lat, lon) => {
    lastLatLon = { lat, lon };
};
const assertClose = (actual, expected, epsilon = 1e-9) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `Expected ${actual} to be within ${epsilon} of ${expected}`);
};

// eslint-disable-next-line no-eval
eval(fnSource);

// Top-left corner should map to the northern & western bounds.
// CRS.Simple uses lat=mapHeight at the top edge.
updateCoordinates({ latlng: { lat: 6144, lng: 0 } });
assertClose(lastLatLon.lat, 73);
assertClose(lastLatLon.lon, 71.65625);

// Bottom-right corner should map to the southern & eastern bounds.
updateCoordinates({ latlng: { lat: 0, lng: 8192 } });
assertClose(lastLatLon.lat, 1.24);
assertClose(lastLatLon.lon, -48.34375);

// Midpoint should be halfway between bounds.
updateCoordinates({ latlng: { lat: 3072, lng: 4096 } });
assertClose(lastLatLon.lat, 37.120000000000005);
assertClose(lastLatLon.lon, 11.65625);

// The pure projection helper should preserve the same interpolation semantics.
const projected = projectMapPointToLatLon(
    { lat: 1536, lng: 2048 },
    currentLatLonBounds,
    currentBounds
);
assertClose(projected.lat, 19.18);
assertClose(projected.lon, 41.65625);

// Locked coordinates should prevent hover updates from mutating state.
coordsLocked = true;
lastLatLon = null;
lockedCoords = { lat: 37.12, lon: 11.65625 };
updateCoordinates({ latlng: { lat: 0, lng: 0 } });
assert.equal(lastLatLon, null);
assert.deepEqual(lockedCoords, { lat: 37.12, lon: 11.65625 });

// Missing bounds should no-op instead of throwing.
coordsLocked = false;
currentBounds = null;
lastLatLon = null;
updateCoordinates({ latlng: { lat: 0, lng: 0 } });
assert.equal(lastLatLon, null);

console.log('updateCoordinates regression checks passed');
