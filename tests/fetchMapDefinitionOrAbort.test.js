const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

// Extract the target function and its dependencies
const fnStart = appSource.indexOf('async function fetchMapDefinitionOrAbort(');
const fnEnd = appSource.indexOf('function setupMapLayers(');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate fetchMapDefinitionOrAbort in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

// Mock globals required by the extracted code
global.loadRequestToken = 0;
global.getMapDefinition = async () => {};
global.abortMapLoad = () => {};

// Evaluate the function source in the local scope, assigning it to a local var just in case
let fetchMapDefinitionOrAbort;
eval(`fetchMapDefinitionOrAbort = ${fnSource}`);

async function runTests() {
    // To spy on console.error
    const originalConsoleError = console.error;

    try {
        console.log('Running tests for fetchMapDefinitionOrAbort...');

        // Test 1: Happy path - getMapDefinition resolves successfully
        global.getMapDefinition = async (requestedMapId, manifestEntry) => {
            return { id: requestedMapId, name: manifestEntry.name };
        };
        global.loadRequestToken = 1;
        let result = await fetchMapDefinitionOrAbort('map1', { name: 'Map One' }, 1, 'hash1');
        assert.deepEqual(result, { id: 'map1', name: 'Map One' });

        // Test 2: Error path - getMapDefinition rejects, requestToken matches loadRequestToken
        let errorLogged = false;
        let abortMapLoadArgs = null;
        console.error = (msg, err) => {
            errorLogged = true;
        };
        global.abortMapLoad = (...args) => {
            abortMapLoadArgs = args;
        };
        global.getMapDefinition = async () => {
            throw new Error('Network error');
        };
        global.loadRequestToken = 2;

        result = await fetchMapDefinitionOrAbort('map2', { name: 'Map Two' }, 2, 'hash2');

        assert.equal(result, null);
        assert.equal(errorLogged, true);
        assert.deepEqual(abortMapLoadArgs, [
            'definition_error',
            'map2',
            'Could not load "Map Two" data. Check the map definition and press Retry.',
            'hash2',
            false,
            true
        ]);

        // Test 3: Error path - getMapDefinition rejects, requestToken DOES NOT match loadRequestToken
        errorLogged = false;
        abortMapLoadArgs = null;
        global.loadRequestToken = 4; // Different token

        result = await fetchMapDefinitionOrAbort('map3', { name: 'Map Three' }, 3, 'hash3');

        assert.equal(result, null);
        assert.equal(errorLogged, false);
        assert.equal(abortMapLoadArgs, null);

        // Test 4: Error path - manifestEntry lacks name (uses requestedMapId in error message)
        errorLogged = false;
        abortMapLoadArgs = null;
        global.loadRequestToken = 5;

        result = await fetchMapDefinitionOrAbort('map4', {}, 5, 'hash4');

        assert.equal(result, null);
        assert.equal(errorLogged, true);
        assert.deepEqual(abortMapLoadArgs, [
            'definition_error',
            'map4',
            'Could not load "map4" data. Check the map definition and press Retry.',
            'hash4',
            false,
            true
        ]);

        console.log('fetchMapDefinitionOrAbort checks passed');
    } finally {
        console.error = originalConsoleError;
    }
}

// Ensure the tests are awaited
runTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
