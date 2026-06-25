const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function handleRouteMapStepNavigation(route, step) {');
const fnEnd = appSource.indexOf('function focusRouteStep(route, step) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate handleRouteMapStepNavigation in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

let currentlyLoadedMapId = 'current-map';
let mapData = [
    { id: 'current-map', url: 'maps/current.json' },
    { id: 'next-map', url: 'maps/next.json' },
    { id: 'unrenderable-map' }
];
let navigateToMapArgs = null;
let analyticsEvents = [];

function findMapRecursive(data, id) {
    return data.find((mapEntry) => mapEntry.id === id) || null;
}

function isRenderableMapEntry(mapEntry) {
    return !!(mapEntry && mapEntry.url);
}

function navigateToMap(...args) {
    navigateToMapArgs = args;
}

function trackAnalytics(...args) {
    analyticsEvents.push(args);
}

// eslint-disable-next-line no-eval
eval(fnSource);

function resetState() {
    currentlyLoadedMapId = 'current-map';
    navigateToMapArgs = null;
    analyticsEvents = [];
}

(function testIgnoresMissingTarget() {
    resetState();
    handleRouteMapStepNavigation({ id: 'route-1' }, {});

    assert.equal(navigateToMapArgs, null, 'Missing map target should not navigate');
    assert.deepEqual(analyticsEvents, [], 'Missing map target should not track unavailable maps');
})();

(function testIgnoresCurrentMapTarget() {
    resetState();
    handleRouteMapStepNavigation({ id: 'route-1' }, { targetId: 'current-map' });

    assert.equal(navigateToMapArgs, null, 'Current map target should not navigate');
    assert.deepEqual(analyticsEvents, [], 'Current map target should not track unavailable maps');
})();

(function testNavigatesToRenderableMap() {
    resetState();
    const targetMap = mapData[1];
    handleRouteMapStepNavigation({ id: 'route-1' }, { targetId: 'next-map' });

    assert.deepEqual(navigateToMapArgs, [
        'next-map',
        { preResolvedMap: targetMap, preserveSearch: true }
    ]);
    assert.deepEqual(analyticsEvents, [], 'Renderable map targets should not be tracked as unavailable');
})();

(function testTracksUnavailableMap() {
    resetState();
    handleRouteMapStepNavigation({ id: 'route-1' }, { targetId: 'unrenderable-map' });

    assert.equal(navigateToMapArgs, null, 'Unavailable map target should not navigate');
    assert.deepEqual(analyticsEvents, [
        ['route_step_map_unavailable', { routeId: 'route-1', targetMapId: 'unrenderable-map' }]
    ]);
})();

console.log('handleRouteMapStepNavigation tests passed');
