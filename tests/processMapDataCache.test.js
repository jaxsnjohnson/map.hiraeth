const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function cloneProcessedMapData(value) {');
const fnEnd = appSource.indexOf('function applyEmbeddedViewOverrides() {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate processMapData function block in js/app.js');
}

global.withAssetVersion = (url) => url;
global.trackAnalytics = () => {};

const fixtureMaps = {
    shared: {
        id: 'shared',
        name: 'Shared Child',
        markers: [{ id: 'shared-marker' }]
    },
    branch: {
        id: 'branch',
        name: 'Branch Child',
        children: ['shared']
    }
};

const fetchCounts = new Map();
global.fetch = async (url) => {
    const match = String(url).match(/^maps\/(.+)\.json$/);
    assert.ok(match, `unexpected URL: ${url}`);

    const childId = match[1];
    fetchCounts.set(childId, (fetchCounts.get(childId) || 0) + 1);
    assert.ok(fixtureMaps[childId], `missing fixture for ${childId}`);

    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => JSON.parse(JSON.stringify(fixtureMaps[childId]))
    };
};

// Evaluate production source so assertions stay coupled to real logic.
// eslint-disable-next-line no-eval
eval(appSource.slice(fnStart, fnEnd));

(async () => {
    const maps = Array.from({ length: 10 }, (_, index) => ({
        id: `parent-${index}`,
        children: ['shared', 'branch']
    }));

    const processed = await processMapData(maps);

    assert.equal(fetchCounts.get('branch'), 1);
    assert.equal(fetchCounts.get('shared'), 2, 'shared should load once at level 1 and once at level 2');

    assert.notEqual(processed[0].children[0], processed[1].children[0]);
    assert.notEqual(processed[0].children[1].children[0], processed[1].children[1].children[0]);

    processed[0].children[0].markers[0].id = 'mutated-marker';
    assert.equal(processed[1].children[0].markers[0].id, 'shared-marker');

    console.log('processMapData child cache regression checks passed');
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
