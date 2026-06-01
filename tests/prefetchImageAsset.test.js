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

let prefetchImagesEnabled = true;
let withAssetVersionCalls = [];
let drainCallCount = 0;
const prefetchedImageUrls = new Set();
let prefetchImageQueue = [];

function getConfigValue(path, fallbackValue) {
    assert.equal(path, 'performance.prefetchImages');
    assert.equal(fallbackValue, true);
    return prefetchImagesEnabled ? fallbackValue : false;
}

function withAssetVersion(url) {
    withAssetVersionCalls.push(url);
    if (!url) return url;
    return `${url}?v=test`;
}

function drainPrefetchImageQueue() {
    drainCallCount += 1;
}

let prefetchImageAsset;
// eslint-disable-next-line no-eval
eval(`prefetchImageAsset = ${extractFunctionSource('prefetchImageAsset')}`);

function resetPrefetchState() {
    prefetchImagesEnabled = true;
    withAssetVersionCalls = [];
    drainCallCount = 0;
    prefetchedImageUrls.clear();
    prefetchImageQueue = [];
}

resetPrefetchState();
prefetchImageAsset('maps/Arfordir.webp');
assert.deepEqual(withAssetVersionCalls, ['maps/Arfordir.webp']);
assert.deepEqual(prefetchImageQueue, ['maps/Arfordir.webp?v=test']);
assert.deepEqual(Array.from(prefetchedImageUrls), ['maps/Arfordir.webp?v=test']);
assert.equal(drainCallCount, 1);

resetPrefetchState();
prefetchImageAsset('maps/Arfordir.webp');
prefetchImageAsset('maps/Arfordir.webp');
assert.deepEqual(prefetchImageQueue, ['maps/Arfordir.webp?v=test']);
assert.deepEqual(Array.from(prefetchedImageUrls), ['maps/Arfordir.webp?v=test']);
assert.equal(drainCallCount, 1);

resetPrefetchState();
prefetchImageAsset('');
assert.deepEqual(prefetchImageQueue, []);
assert.deepEqual(Array.from(prefetchedImageUrls), []);
assert.equal(drainCallCount, 0);

resetPrefetchState();
prefetchImagesEnabled = false;
prefetchImageAsset('maps/Arfordir.webp');
assert.deepEqual(withAssetVersionCalls, []);
assert.deepEqual(prefetchImageQueue, []);
assert.deepEqual(Array.from(prefetchedImageUrls), []);
assert.equal(drainCallCount, 0);

console.log('prefetchImageAsset queue behavior tests passed');
