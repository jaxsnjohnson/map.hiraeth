#!/usr/bin/env node

const fs = require('node:fs');
const { performance } = require('node:perf_hooks');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function cloneProcessedMapData(value) {');
const fnEnd = appSource.indexOf('function applyEmbeddedViewOverrides() {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate processMapData function block in js/app.js');
}

global.withAssetVersion = (url) => url;
global.trackAnalytics = () => {};

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function createFixtures() {
    const payload = Array.from({ length: 250 }, (_, index) => ({
        id: `point-${index}`,
        coords: [index, index * 2],
        type: index % 2 ? 'landmark' : 'settlement'
    }));

    return {
        shared: { id: 'shared', name: 'Shared Child', pointsOfInterest: payload },
        uniqueA: { id: 'uniqueA', name: 'Unique A', children: ['leaf'], pointsOfInterest: payload },
        uniqueB: { id: 'uniqueB', name: 'Unique B', children: ['leaf'], pointsOfInterest: payload },
        leaf: { id: 'leaf', name: 'Leaf Child', pointsOfInterest: payload }
    };
}

function createMaps() {
    return Array.from({ length: 20 }, (_, index) => ({
        id: `parent-${index}`,
        children: ['shared', index % 2 ? 'uniqueA' : 'uniqueB']
    }));
}

function createLimitedFetch(fixtures, options = {}) {
    const delayMs = options.delayMs || 5;
    const maxConcurrent = options.maxConcurrent || 6;
    const fetchCounts = new Map();
    let active = 0;
    const queue = [];

    function acquire() {
        if (active < maxConcurrent) {
            active += 1;
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            queue.push(resolve);
        }).then(() => {
            active += 1;
        });
    }

    function release() {
        active -= 1;
        const next = queue.shift();
        if (next) next();
    }

    async function fetch(url) {
        const match = String(url).match(/^maps\/(.+)\.json$/);
        if (!match) throw new Error(`Unexpected URL: ${url}`);

        const childId = match[1];
        fetchCounts.set(childId, (fetchCounts.get(childId) || 0) + 1);

        await acquire();
        try {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            const body = fixtures[childId];
            if (!body) {
                return {
                    ok: false,
                    status: 404,
                    statusText: 'Not Found',
                    json: async () => ({})
                };
            }

            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => cloneJson(body)
            };
        } finally {
            release();
        }
    }

    return { fetch, fetchCounts };
}

async function referenceProcessChild(childId, level = 0) {
    if (level > 5 || !childId || typeof childId !== 'string') {
        return { id: childId, name: String(childId || 'Invalid Child'), status: 'coming-soon', error: true };
    }

    try {
        const response = await fetch(withAssetVersion(`maps/${childId}.json`));

        if (response.ok) {
            const childData = await response.json();

            if (childData.children && Array.isArray(childData.children) && childData.children.length > 0 && typeof childData.children[0] === 'string') {
                const subChildIds = childData.children;
                childData.children = [];
                const subChildPromises = subChildIds.map(subId => referenceProcessChild(subId, level + 1));
                childData.children = await Promise.all(subChildPromises);
            }

            childData.id = childData.id || childId;
            childData.name = childData.name || childId;
            return childData;
        } else if (response.status === 404) {
            return { id: childId, name: childId, status: 'coming-soon', error: 'not found' };
        }

        return { id: childId, name: childId, status: 'coming-soon', error: `Workspace failed (${response.status})` };
    } catch (error) {
        return { id: childId, name: childId, status: 'coming-soon', error: error.message };
    }
}

async function referenceProcessMapData(maps) {
    const mapPromises = maps.map(async (map) => {
        if (map.children && Array.isArray(map.children) && map.children.length > 0 && typeof map.children[0] === 'string') {
            const childIds = map.children;
            map.children = [];
            const childPromises = childIds.map(childId => referenceProcessChild(childId, 1));
            map.children = await Promise.all(childPromises);
        }
        return map;
    });

    return await Promise.all(mapPromises);
}

function loadProductionProcessMapData() {
    // Evaluate production source so the cached benchmark stays coupled to real logic.
    // eslint-disable-next-line no-eval
    eval(appSource.slice(fnStart, fnEnd));
    return processMapData;
}

async function runCase(label, processMapDataImpl) {
    const fixtures = createFixtures();
    const { fetch, fetchCounts } = createLimitedFetch(fixtures);
    global.fetch = fetch;

    const startedAt = performance.now();
    await processMapDataImpl(createMaps());
    const elapsedMs = performance.now() - startedAt;
    const fetchTotal = Array.from(fetchCounts.values()).reduce((total, count) => total + count, 0);

    return {
        label,
        elapsedMs,
        fetchTotal,
        fetchCounts: Object.fromEntries(fetchCounts)
    };
}

(async () => {
    const productionProcessMapData = loadProductionProcessMapData();
    const baseline = await runCase('baseline uncached reference', referenceProcessMapData);
    const optimized = await runCase('optimized production cache', productionProcessMapData);
    const fetchReduction = baseline.fetchTotal - optimized.fetchTotal;
    const fetchReductionPct = (fetchReduction / baseline.fetchTotal) * 100;
    const timeReductionPct = ((baseline.elapsedMs - optimized.elapsedMs) / baseline.elapsedMs) * 100;

    console.log('processMapData child-load benchmark');
    console.log(`Baseline:  ${baseline.elapsedMs.toFixed(2)}ms, ${baseline.fetchTotal} fetches`, baseline.fetchCounts);
    console.log(`Optimized: ${optimized.elapsedMs.toFixed(2)}ms, ${optimized.fetchTotal} fetches`, optimized.fetchCounts);
    console.log(`Fetch reduction: ${fetchReduction} fewer fetches (${fetchReductionPct.toFixed(1)}%)`);
    console.log(`Time change: ${timeReductionPct.toFixed(1)}%`);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
