const assert = require('node:assert/strict');
const fs = require('node:fs');

const editorSource = fs.readFileSync('js/map-editor.js', 'utf8');

const fnStart = editorSource.indexOf('function exportCurrentMapJson(');
const fnEnd = editorSource.indexOf('function exportAtlasStructure(');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate exportCurrentMapJson in js/map-editor.js');
}

const fnSource = editorSource.slice(fnStart, fnEnd);

let downloadJsonFileArgs = null;
let setExportStatusArgs = null;
let consoleErrorArgs = null;

// Mock dependencies
global.state = {};
global.utils = {};
global.getCurrentPoints = () => [];
global.getCurrentRegions = () => [];
global.getCurrentLines = () => [];
global.readMapSettingsForm = () => ({});
global.getExportFileName = () => 'test.json';
global.downloadJsonFile = (name, doc) => {
    downloadJsonFileArgs = { name, doc };
};
global.setExportStatus = (msg, isErr) => {
    setExportStatusArgs = { msg, isErr };
};

const originalConsoleError = console.error;
global.console.error = (err) => {
    consoleErrorArgs = err;
};

// eslint-disable-next-line no-eval
eval(fnSource);

function resetMocks() {
    downloadJsonFileArgs = null;
    setExportStatusArgs = null;
    consoleErrorArgs = null;
    global.state = {
        currentMap: { id: 'test-map', dataUrl: 'test-map.json' },
        atlasTree: ['tree-data'],
        lineCollectionKey: 'lines'
    };
    global.utils = {
        serializeMapDocumentState: (opts) => JSON.stringify(opts)
    };
    global.getCurrentPoints = () => ['point1'];
    global.getCurrentRegions = () => ['region1'];
    global.getCurrentLines = () => ['line1'];
    global.readMapSettingsForm = () => ({ bg: 'black' });
    global.getExportFileName = (url, id) => 'test-map-export.json';
}

// Test 1: No current map
resetMocks();
global.state.currentMap = null;
exportCurrentMapJson();
assert.strictEqual(downloadJsonFileArgs, null);
assert.strictEqual(setExportStatusArgs, null);
assert.strictEqual(consoleErrorArgs, null);

// Test 2: Successful export
resetMocks();
exportCurrentMapJson();

assert.deepStrictEqual(downloadJsonFileArgs, {
    name: 'test-map-export.json',
    doc: JSON.stringify({
        masterMapData: ['tree-data'],
        currentMapId: 'test-map',
        collectedPoints: ['point1'],
        collectedRegions: ['region1'],
        collectedLines: ['line1'],
        lineCollectionKey: 'lines',
        mapSettings: { bg: 'black' }
    })
});
assert.deepStrictEqual(setExportStatusArgs, {
    msg: 'Exported test-map-export.json.',
    isErr: undefined
});
assert.strictEqual(consoleErrorArgs, null);

// Test 3: Exception handling
resetMocks();
global.utils.serializeMapDocumentState = () => {
    throw new Error('Test Serialization Error');
};
exportCurrentMapJson();

assert.strictEqual(downloadJsonFileArgs, null);
assert.deepStrictEqual(setExportStatusArgs, {
    msg: 'Test Serialization Error',
    isErr: true
});
assert.match(consoleErrorArgs.toString(), /Test Serialization Error/);

// Test 4: Exception handling (no error message)
resetMocks();
global.utils.serializeMapDocumentState = () => {
    throw new Error('');
};
exportCurrentMapJson();
assert.deepStrictEqual(setExportStatusArgs, {
    msg: 'Could not export the current map.',
    isErr: true
});

global.console.error = originalConsoleError;
console.log('All tests passed for exportCurrentMapJson!');
