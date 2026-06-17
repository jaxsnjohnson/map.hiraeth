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

let prefetchImageInFlight = false;
let prefetchImageQueue = [];
let prefetchedImageUrls = new Set();
let mockImageInstances = [];

global.Image = class {
    constructor() {
        this.onload = null;
        this.onerror = null;
        this.src = '';
        mockImageInstances.push(this);
    }
};

let drainPrefetchImageQueue;
// eslint-disable-next-line no-eval
eval(`drainPrefetchImageQueue = ${extractFunctionSource('drainPrefetchImageQueue')}`);

function resetState() {
    prefetchImageInFlight = false;
    prefetchImageQueue = [];
    prefetchedImageUrls.clear();
    mockImageInstances = [];
}

// 1. Should return early if an image is already in flight
resetState();
prefetchImageInFlight = true;
prefetchImageQueue = ['url1'];
drainPrefetchImageQueue();
assert.equal(mockImageInstances.length, 0);
assert.equal(prefetchImageQueue.length, 1);

// 2. Should return early if the queue is empty
resetState();
drainPrefetchImageQueue();
assert.equal(mockImageInstances.length, 0);

// 3. Should process the next URL in the queue
resetState();
prefetchImageQueue = ['url1', 'url2'];
drainPrefetchImageQueue();
assert.equal(prefetchImageInFlight, true);
assert.equal(prefetchImageQueue.length, 1);
assert.equal(prefetchImageQueue[0], 'url2');
assert.equal(mockImageInstances.length, 1);
assert.equal(mockImageInstances[0].src, 'url1');

// 4. Should process the next URL when the image loads
resetState();
prefetchImageQueue = ['url1', 'url2'];
drainPrefetchImageQueue();
assert.equal(mockImageInstances.length, 1);
assert.equal(prefetchImageInFlight, true);

// Trigger onload
mockImageInstances[0].onload();

assert.equal(mockImageInstances.length, 2);
assert.equal(mockImageInstances[1].src, 'url2');
assert.equal(prefetchImageInFlight, true);
assert.equal(prefetchImageQueue.length, 0);

// Trigger onload for second image
mockImageInstances[1].onload();
assert.equal(prefetchImageInFlight, false);

// 5. Should handle image load errors by deleting from prefetchedImageUrls and processing the next URL
resetState();
prefetchImageQueue = ['url1', 'url2'];
prefetchedImageUrls.add('url1');
prefetchedImageUrls.add('url2');
drainPrefetchImageQueue();

assert.equal(mockImageInstances.length, 1);
assert.equal(prefetchImageInFlight, true);

// Trigger onerror
mockImageInstances[0].onerror();

assert.equal(prefetchedImageUrls.has('url1'), false);
assert.equal(prefetchedImageUrls.has('url2'), true);
assert.equal(mockImageInstances.length, 2);
assert.equal(mockImageInstances[1].src, 'url2');

// 6. Should return if nextUrl is empty
resetState();
prefetchImageQueue = [undefined, 'url2'];
drainPrefetchImageQueue();
assert.equal(prefetchImageInFlight, false);
assert.equal(mockImageInstances.length, 0);

console.log('drainPrefetchImageQueue behavior tests passed');
