const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const sandbox = {
    coordsLocked: false,
    currentLatLonBounds: {
        north: 73,
        south: 1.24,
        east: -48.34375,
        west: 71.65625
    },
    currentBounds: [[0, 0], [6144, 8192]],
    updateCoordinateDisplay: () => {}, // Mocked below
    console,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean
};

// Extract functions securely without relying on strict formatting.
const functionNames = [
    'getMapPixelDimensions',
    'projectMapPointToLatLon',
    'updateCoordinates'
];

let extractedCode = '';
for (const fnName of functionNames) {
    const fnRegex = new RegExp(`function\\s+${fnName}\\s*\\([\\s\\S]*?\\)\\s*{`);
    const match = appSource.match(fnRegex);
    if (!match) throw new Error(`Could not find function ${fnName}`);

    let startIndex = match.index;
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let endIndex = startIndex;

    // Find the matching closing brace
    for (let i = startIndex; i < appSource.length; i++) {
        const char = appSource[i];
        const prevChar = i > 0 ? appSource[i-1] : '';

        if (!inString && (char === "'" || char === '"' || char === '`')) {
            inString = true;
            stringChar = char;
        } else if (inString && char === stringChar && prevChar !== '\\') {
            inString = false;
        } else if (!inString) {
            if (char === '{') braceCount++;
            else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
    }
    extractedCode += appSource.slice(startIndex, endIndex) + '\n\n';
}

vm.createContext(sandbox);
vm.runInContext(extractedCode, sandbox);

let lastLatLon = null;
sandbox.updateCoordinateDisplay = (lat, lon) => {
    lastLatLon = { lat, lon };
};

const assertClose = (actual, expected, epsilon = 1e-9) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `Expected ${actual} to be within ${epsilon} of ${expected}`);
};

// Top-left corner should map to the northern & western bounds.
sandbox.updateCoordinates({ latlng: { lat: 6144, lng: 0 } });
assertClose(lastLatLon.lat, 73);
assertClose(lastLatLon.lon, 71.65625);

// Bottom-right corner should map to the southern & eastern bounds.
sandbox.updateCoordinates({ latlng: { lat: 0, lng: 8192 } });
assertClose(lastLatLon.lat, 1.24);
assertClose(lastLatLon.lon, -48.34375);

// Midpoint should be halfway between bounds.
sandbox.updateCoordinates({ latlng: { lat: 3072, lng: 4096 } });
assertClose(lastLatLon.lat, 37.120000000000005);
assertClose(lastLatLon.lon, 11.65625);

// The pure projection helper should preserve the same interpolation semantics.
const projected = sandbox.projectMapPointToLatLon(
    { lat: 1536, lng: 2048 },
    sandbox.currentLatLonBounds,
    sandbox.currentBounds
);
assertClose(projected.lat, 19.18);
assertClose(projected.lon, 41.65625);

// Locked coordinates should prevent hover updates from mutating state.
sandbox.coordsLocked = true;
lastLatLon = null;
sandbox.updateCoordinates({ latlng: { lat: 0, lng: 0 } });
assert.equal(lastLatLon, null);

// Missing bounds should no-op instead of throwing.
sandbox.coordsLocked = false;
sandbox.currentBounds = null;
lastLatLon = null;
sandbox.updateCoordinates({ latlng: { lat: 0, lng: 0 } });
assert.equal(lastLatLon, null);

console.log('updateCoordinates regression checks passed');
