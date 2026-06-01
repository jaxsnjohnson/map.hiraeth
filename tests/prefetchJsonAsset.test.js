const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionRange(startMarker, endMarker) {
    const start = appSource.indexOf(startMarker);
    if (start === -1) {
        throw new Error(`Could not find start marker: ${startMarker}`);
    }
    const end = endMarker ? appSource.indexOf(endMarker, start) : appSource.length;
    if (end === -1) {
        throw new Error(`Could not find end marker: ${endMarker}`);
    }
    return appSource.slice(start, end);
}

// Extract dependencies
global.getConfigValue = (path, fallback) => {
    if (path === 'performance.prefetchJson') return global.prefetchJsonEnabled !== false;
    return fallback;
};
global.withAssetVersion = (url) => `${url}?v=test`;
global.prefetchedJsonUrls = new Set();
global.fetch = async (url, options) => {
    if (global.fetchShouldFail) {
        throw new Error('Network error');
    }
    global.fetchCalls.push({ url, options });
    return { ok: true };
};
global.prefetchJsonEnabled = true;
global.fetchShouldFail = false;
global.fetchCalls = [];

const prefetchCode = extractFunctionRange('async function prefetchJsonAsset(', 'function prefetchImageAsset(');

// eslint-disable-next-line no-eval
eval(prefetchCode);

async function runTests() {
    console.log('Running prefetchJsonAsset tests...');

    // Setup
    global.prefetchedJsonUrls.clear();
    global.fetchCalls = [];
    global.prefetchJsonEnabled = true;
    global.fetchShouldFail = false;

    // Test 1: Disabled via config
    global.prefetchJsonEnabled = false;
    await prefetchJsonAsset('test.json');
    assert.equal(global.prefetchedJsonUrls.size, 0, 'Should not prefetch if config is disabled');
    assert.equal(global.fetchCalls.length, 0, 'Should not call fetch if config is disabled');

    // Test 2: Successful prefetch
    global.prefetchJsonEnabled = true;
    await prefetchJsonAsset('test1.json');
    assert.equal(global.prefetchedJsonUrls.size, 1, 'Should add to Set');
    assert.equal(global.prefetchedJsonUrls.has('test1.json?v=test'), true, 'Should use normalized URL');
    assert.equal(global.fetchCalls.length, 1, 'Should call fetch');
    assert.equal(global.fetchCalls[0].url, 'test1.json?v=test', 'Fetch should use normalized URL');
    assert.deepEqual(global.fetchCalls[0].options, { credentials: 'same-origin' }, 'Fetch should use credentials');

    // Test 3: Duplicate prefetch (already in set)
    global.fetchCalls = [];
    await prefetchJsonAsset('test1.json');
    assert.equal(global.prefetchedJsonUrls.size, 1, 'Set size should not increase');
    assert.equal(global.fetchCalls.length, 0, 'Should not call fetch again for same URL');

    // Test 4: Empty URL
    global.fetchCalls = [];
    const prevSize = global.prefetchedJsonUrls.size;
    await prefetchJsonAsset('');
    assert.equal(global.prefetchedJsonUrls.size, prevSize, 'Should not add empty URL');
    assert.equal(global.fetchCalls.length, 0, 'Should not fetch empty URL');

    // Test 5: Fetch failure removes from set
    global.fetchCalls = [];
    global.fetchShouldFail = true;
    await prefetchJsonAsset('fail.json');
    assert.equal(global.prefetchedJsonUrls.has('fail.json?v=test'), false, 'Should remove URL from Set on failure');

    console.log('prefetchJsonAsset tests passed');
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
