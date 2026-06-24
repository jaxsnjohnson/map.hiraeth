const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionSource(name) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < appSource.length; i += 1) {
        const char = appSource[i];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }
    if (end === -1) {
        throw new Error(`Could not parse function ${name}`);
    }
    return appSource.slice(start, end);
}

const functionString = extractFunctionSource('clampZoomLevel');

// evaluate the function by itself and wrap in a scope with required variables

const runTest = () => {
    let map = null;
    let mapOptions = {};

    // Create the function taking map and mapOptions as closure variables
    const clampZoomLevel = new Function('map', 'mapOptions', `
        return (${functionString});
    `)()(map, mapOptions);

    // Wait, let's restructure this to be cleaner.
};

// Rebuild evaluation context using new Function or eval in local scope
const testSuite = `
    ${functionString}

    // Scenario 1: !map
    map = null;
    assert.equal(clampZoomLevel(5), 5);

    // Scenario 2: !Number.isFinite(zoom)
    map = {};
    assert.ok(Number.isNaN(clampZoomLevel(NaN)));
    assert.equal(clampZoomLevel(Infinity), Infinity);
    assert.equal(clampZoomLevel(-Infinity), -Infinity);
    assert.equal(clampZoomLevel('invalid'), 'invalid');

    // Scenario 3: map.getMinZoom and map.getMaxZoom are functions
    map = {
        getMinZoom: () => -2,
        getMaxZoom: () => 5
    };
    mapOptions = {
        minZoom: -5,
        maxZoom: 10
    };
    assert.equal(clampZoomLevel(0), 0);
    assert.equal(clampZoomLevel(5), 5);
    assert.equal(clampZoomLevel(6), 5);
    assert.equal(clampZoomLevel(-2), -2);
    assert.equal(clampZoomLevel(-3), -2);

    // Scenario 4: map.getMinZoom and map.getMaxZoom are not functions
    map = {};
    mapOptions = {
        minZoom: -1,
        maxZoom: 3
    };
    assert.equal(clampZoomLevel(0), 0);
    assert.equal(clampZoomLevel(3), 3);
    assert.equal(clampZoomLevel(4), 3);
    assert.equal(clampZoomLevel(-1), -1);
    assert.equal(clampZoomLevel(-2), -1);

    // Scenario 5: mixed
    map = {
        getMinZoom: () => 0
    };
    mapOptions = {
        minZoom: -5,
        maxZoom: 2
    };
    assert.equal(clampZoomLevel(-1), 0);
    assert.equal(clampZoomLevel(3), 2);
`;

const runner = new Function('assert', 'let map = null; let mapOptions = {}; ' + testSuite);
runner(assert);
console.log('clampZoomLevel tests passed');
