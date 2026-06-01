const assert = require('node:assert/strict');
const { afterEach, beforeEach, describe, it } = require('node:test');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function cloneProcessedMapData(value) {');
const fnEnd = appSource.indexOf('async function processMapData(maps)');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate loadChildMapData function block in js/app.js');
}

function createSpy(implementation = () => undefined) {
    const spy = (...args) => {
        spy.calls.push(args);
        return implementation(...args);
    };
    spy.calls = [];
    return spy;
}

global.withAssetVersion = url => url;

let loadChildMapDataUnderTest;

// eslint-disable-next-line no-eval
eval(`${appSource.slice(fnStart, fnEnd)}
loadChildMapDataUnderTest = loadChildMapData;`);

describe('loadChildMapData', () => {
    let originalConsoleWarn;
    let originalConsoleError;
    let warnSpy;
    let errorSpy;
    let trackAnalyticsSpy;

    beforeEach(() => {
        originalConsoleWarn = console.warn;
        originalConsoleError = console.error;
        warnSpy = createSpy();
        errorSpy = createSpy();
        trackAnalyticsSpy = createSpy();
        console.warn = warnSpy;
        console.error = errorSpy;
        global.trackAnalytics = trackAnalyticsSpy;
    });

    afterEach(() => {
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
    });

    it('loads child map data successfully', async () => {
        global.fetch = createSpy(async url => {
            assert.equal(url, 'maps/map1.json');
            return {
                ok: true,
                json: async () => ({ id: 'map1', name: 'Map 1' })
            };
        });

        const result = await loadChildMapDataUnderTest('map1', 0);

        assert.equal(result.id, 'map1');
        assert.equal(result.name, 'Map 1');
        assert.equal(global.fetch.calls.length, 1);
    });

    it('uses the child id as fallback data when fetched data is incomplete', async () => {
        global.fetch = async () => ({
            ok: true,
            json: async () => ({})
        });

        const result = await loadChildMapDataUnderTest('map2', 0);

        assert.equal(result.id, 'map2');
        assert.equal(result.name, 'map2');
    });

    it('recursively loads child ids', async () => {
        let fetchCount = 0;
        global.fetch = async url => {
            fetchCount += 1;
            const responses = {
                'maps/parent.json': { id: 'parent', children: ['child1', 'child2'] },
                'maps/child1.json': { id: 'child1', name: 'Child 1' },
                'maps/child2.json': { id: 'child2', name: 'Child 2' }
            };
            return {
                ok: true,
                json: async () => responses[url]
            };
        };

        const result = await loadChildMapDataUnderTest('parent', 0);

        assert.equal(result.id, 'parent');
        assert.deepEqual(result.children.map(child => child.id), ['child1', 'child2']);
        assert.equal(fetchCount, 3);
    });

    it('deduplicates repeated recursive children when a cache is provided', async () => {
        const fetchCalls = [];
        global.fetch = async url => {
            fetchCalls.push(url);
            const responses = {
                'maps/parent.json': { id: 'parent', children: ['child', 'child'] },
                'maps/child.json': { id: 'child', name: 'Shared Child' }
            };
            return {
                ok: true,
                json: async () => responses[url]
            };
        };

        const result = await loadChildMapDataUnderTest('parent', 0, new Map());

        assert.deepEqual(result.children.map(child => child.id), ['child', 'child']);
        assert.deepEqual(fetchCalls, ['maps/parent.json', 'maps/child.json']);
        assert.notEqual(result.children[0], result.children[1]);
    });

    it('returns a coming-soon placeholder for missing child maps', async () => {
        global.fetch = async () => ({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        });

        const result = await loadChildMapDataUnderTest('missing', 0);

        assert.deepEqual(result, {
            id: 'missing',
            name: 'missing',
            status: 'coming-soon',
            error: 'not found'
        });
        assert.equal(warnSpy.calls.length, 1);
        assert.deepEqual(trackAnalyticsSpy.calls[0], [
            'child_map_load_failed',
            { childId: 'missing', reason: 'not_found' }
        ]);
    });

    it('returns a coming-soon placeholder for non-404 fetch errors', async () => {
        global.fetch = async () => ({
            ok: false,
            status: 500,
            statusText: 'Server Error'
        });

        const result = await loadChildMapDataUnderTest('error500', 0);

        assert.deepEqual(result, {
            id: 'error500',
            name: 'error500',
            status: 'coming-soon',
            error: 'Workspace failed (500)'
        });
        assert.equal(warnSpy.calls.length, 1);
        assert.deepEqual(trackAnalyticsSpy.calls[0], [
            'child_map_load_failed',
            { childId: 'error500', reason: 'http_error_500' }
        ]);
    });

    it('returns a coming-soon placeholder when fetch throws', async () => {
        global.fetch = async () => {
            throw new Error('Network failure');
        };

        const result = await loadChildMapDataUnderTest('fail', 0);

        assert.deepEqual(result, {
            id: 'fail',
            name: 'fail',
            status: 'coming-soon',
            error: 'Network failure'
        });
        assert.equal(errorSpy.calls.length, 1);
        assert.deepEqual(trackAnalyticsSpy.calls[0], [
            'child_map_load_failed',
            { childId: 'fail', reason: 'Network failure' }
        ]);
    });
});
