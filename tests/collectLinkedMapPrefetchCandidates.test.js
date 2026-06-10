const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

// Extract collectLinkedMapPrefetchCandidates using slicing up to the next function declaration
const fnStart = appSource.indexOf('function collectLinkedMapPrefetchCandidates(mapDefinition) {');
const fnEnd = appSource.indexOf('function schedulePostLoadPrefetch(mapDefinition) {');
if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate collectLinkedMapPrefetchCandidates function in js/app.js');
}
const fnSource = appSource.slice(fnStart, fnEnd);

// Mock globals
let currentlyLoadedMapId = 'current-map';
let mapData = [
    { id: 'map1', renderable: true },
    { id: 'map2', renderable: false },
    { id: 'map3', renderable: true }
];

function findMapRecursive(data, id) {
    return data.find(m => m.id === id);
}

function isRenderableMapEntry(item) {
    return item && item.renderable;
}

function getVisiblePoints(def) { return def.points || []; }
function getVisibleRegions(def) { return def.regions || []; }
function getVisibleLines(def) { return def.lines || []; }
function getVisibleRoutes(def) { return def.routes || []; }

// eslint-disable-next-line no-eval
eval(fnSource);

function runTests() {
    // 1. Empty definitions
    assert.deepEqual(collectLinkedMapPrefetchCandidates({}), [], 'Should handle empty definition');

    // 2. Extracts from different feature types
    const defAllTypes = {
        points: [{ linkedMapId: 'map1' }],
        regions: [{ linkedMapId: 'map1' }],
        lines: [{ linkedMapId: 'map3' }],
        routes: [
            { steps: [{ targetType: 'map', targetId: 'map1' }, { targetType: 'poi', targetId: 'poi1' }] }
        ]
    };
    assert.deepEqual(
        collectLinkedMapPrefetchCandidates(defAllTypes),
        ['map1', 'map3'],
        'Should collect from points, regions, lines, routes and deduplicate'
    );

    // 3. Trimming and ignoring empty strings
    const defEmptyStrings = {
        points: [{ linkedMapId: '  ' }, { linkedMapId: '' }, { linkedMapId: null }, { linkedMapId: ' map1  ' }]
    };
    assert.deepEqual(
        collectLinkedMapPrefetchCandidates(defEmptyStrings),
        ['map1'],
        'Should ignore empty strings and trim whitespace'
    );

    // 4. Ignoring current map ID
    const defCurrentMap = {
        points: [{ linkedMapId: 'current-map' }, { linkedMapId: 'map3' }]
    };
    assert.deepEqual(
        collectLinkedMapPrefetchCandidates(defCurrentMap),
        ['map3'],
        'Should ignore currently loaded map ID'
    );

    // 5. Ignoring non-existent maps
    const defMissingMap = {
        points: [{ linkedMapId: 'map999' }, { linkedMapId: 'map1' }]
    };
    assert.deepEqual(
        collectLinkedMapPrefetchCandidates(defMissingMap),
        ['map1'],
        'Should ignore maps that cannot be found'
    );

    // 6. Ignoring unrenderable maps
    const defUnrenderableMap = {
        points: [{ linkedMapId: 'map2' }, { linkedMapId: 'map1' }]
    };
    assert.deepEqual(
        collectLinkedMapPrefetchCandidates(defUnrenderableMap),
        ['map1'],
        'Should ignore maps that are not renderable'
    );

    console.log('collectLinkedMapPrefetchCandidates tests passed');
}

runTests();
