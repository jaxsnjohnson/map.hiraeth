const assert = require('node:assert/strict');

const {
    buildFeatureSelectionKey,
    detectLineCollectionKey,
    filterMapTree,
    findMapRecursive,
    normalizeManifestTree,
    normalizePoint,
    resolveFeatureIndexFromSelection,
    serializeEditorState
} = require('../js/editor-shared.js');

const manifest = [
    {
        id: 'folder-root',
        name: 'Root',
        type: 'folder',
        children: [
            {
                id: 'main-map',
                name: 'Main Map',
                imageUrl: 'maps/main.webp',
                width: 100,
                height: 100,
                scalePixels: 3,
                scaleKilometers: 1,
                blurb: 'Original blurb',
                pointsOfInterest: [
                    {
                        id: 'poi-1',
                        name: 'Old Dock',
                        coords: [10, 20],
                        type: 'Harbor',
                        summary: 'Original summary',
                        linkedMapId: 'harbor-map',
                        customFlag: true
                    }
                ],
                regions: [
                    {
                        id: 'region-1',
                        name: 'North Ward',
                        type: 'Political',
                        value: 'District',
                        coordinates: [[0, 0], [0, 10], [10, 10]],
                        linkedMapId: 'ward-map'
                    }
                ],
                roads: [
                    {
                        id: 'road-1',
                        name: 'Old Road',
                        type: 'main_road',
                        coordinates: [[1, 1], [2, 2]],
                        linkedMapId: 'road-map'
                    }
                ]
            }
        ]
    }
];

const clonedManifest = normalizeManifestTree(manifest);
assert.notEqual(clonedManifest, manifest);
assert.equal(findMapRecursive(clonedManifest, 'main-map').name, 'Main Map');

const filtered = filterMapTree(clonedManifest, 'main');
assert.equal(filtered.length, 1);
assert.equal(filtered[0].children.length, 1);
assert.equal(filtered[0].children[0].id, 'main-map');

const normalizedPoint = normalizePoint({
    name: 'Round Trip',
    coords: ['11.7', '9.2'],
    linkedMapId: 'linked-map'
});
assert.deepEqual(normalizedPoint.coords, [12, 9]);
assert.equal(normalizedPoint.linkedMapId, 'linked-map');

assert.equal(detectLineCollectionKey(findMapRecursive(clonedManifest, 'main-map')), 'roads');
assert.equal(detectLineCollectionKey({ lines: [] }), 'lines');
assert.equal(detectLineCollectionKey({}), 'lines');

const serializedManifest = serializeEditorState({
    masterMapData: clonedManifest,
    currentMapId: 'main-map',
    collectedPoints: [
        {
            id: 'poi-1',
            name: 'Old Dock',
            coords: [10, 20],
            type: 'Harbor',
            summary: 'Updated summary',
            linkedMapId: 'harbor-map',
            customFlag: true
        },
        {
            name: 'New Plaza',
            coords: [15, 30],
            type: 'Point of Interest',
            linkedMapId: 'plaza-map',
            properties: { mood: 'busy' }
        }
    ],
    collectedRegions: [
        {
            id: 'region-1',
            name: 'North Ward',
            type: 'Political',
            value: 'District',
            coordinates: [[0, 0], [0, 10], [10, 10]],
            linkedMapId: 'ward-map'
        },
        {
            name: 'South Ward',
            type: 'Political',
            value: 'District',
            coordinates: [[10, 10], [20, 20], [10, 20]],
            linkedMapId: 'south-map'
        }
    ],
    collectedLines: [
        {
            id: 'road-1',
            name: 'Old Road',
            type: 'main_road',
            coordinates: [[1, 1], [2, 2]],
            linkedMapId: 'road-map'
        }
    ],
    mapSettings: {
        name: 'Main Map',
        scalePixels: 5,
        scaleKilometers: 2.5,
        blurb: 'Updated blurb'
    },
    lineCollectionKey: 'roads'
});

const serializedMap = findMapRecursive(serializedManifest, 'main-map');
assert.equal(serializedMap.scalePixels, 5);
assert.equal(serializedMap.scaleKilometers, 2.5);
assert.equal(serializedMap.blurb, 'Updated blurb');
assert.equal(serializedMap.pointsOfInterest.find((point) => point.name === 'Old Dock').customFlag, true);
assert.equal(serializedMap.pointsOfInterest.find((point) => point.name === 'Old Dock').linkedMapId, 'harbor-map');
assert.equal(serializedMap.pointsOfInterest.find((point) => point.name === 'New Plaza').linkedMapId, 'plaza-map');
assert.equal(serializedMap.regions.find((region) => region.name === 'South Ward').linkedMapId, 'south-map');
assert.equal(serializedMap.roads.find((line) => line.id === 'road-1').linkedMapId, 'road-map');
assert.equal(serializedMap.lines, undefined);
assert.deepEqual(serializedMap.filterGroups, {
    Regions: {
        Political: ['District']
    }
});

const selectedMapOnly = serializeEditorState({
    masterMapData: clonedManifest,
    currentMapId: 'main-map',
    collectedPoints: [],
    collectedRegions: [],
    collectedLines: [],
    mapSettings: {},
    lineCollectionKey: 'lines',
    selectedMapOnly: true
});
assert.equal(selectedMapOnly.id, 'main-map');
assert.deepEqual(selectedMapOnly.lines, []);
assert.equal(selectedMapOnly.roads, undefined);

const pointSelection = buildFeatureSelectionKey('points', { name: 'Old Dock' });
assert.equal(
    resolveFeatureIndexFromSelection(
        'points',
        [{ name: 'Old Dock' }, { name: 'New Plaza' }],
        pointSelection
    ),
    0
);

const lineSelection = buildFeatureSelectionKey('lines', { id: 'road-1', name: 'Old Road' });
assert.equal(
    resolveFeatureIndexFromSelection(
        'lines',
        [{ id: 'road-1', name: 'Old Road' }, { id: 'road-2', name: 'North Track' }],
        lineSelection
    ),
    0
);

console.log('editor shared helper regression checks passed');
