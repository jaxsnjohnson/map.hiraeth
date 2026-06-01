const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('async function loadChildMapData(');
const fnEnd = appSource.indexOf('async function processMapData(maps)');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate loadChildMapData function block in js/app.js');
}

global.withAssetVersion = (url) => url;
global.trackAnalytics = () => {};

let originalConsoleWarn = console.warn;
let originalConsoleError = console.error;

// mock dependencies
global.processChild = async (childId, level, cache) => {
    return { id: childId, processed: true };
};

const evalSource = appSource.slice(fnStart, fnEnd);

// eslint-disable-next-line no-eval
eval(evalSource);

(async () => {
    // 1. Success case without children
    global.fetch = async (url) => {
        return {
            ok: true,
            json: async () => ({ id: 'test1', name: 'Test 1' })
        };
    };
    const res1 = await loadChildMapData('test1', 1);
    assert.equal(res1.id, 'test1');
    assert.equal(res1.name, 'Test 1');

    // 2. Success case with children
    global.fetch = async (url) => {
        return {
            ok: true,
            json: async () => ({ id: 'test2', name: 'Test 2', children: ['child1'] })
        };
    };

    const res2 = await loadChildMapData('test2', 1);
    assert.deepEqual(res2.children, [{ id: 'child1', processed: true }]);

    // 3. 404 case
    console.warn = () => {}; // suppress warnings
    global.fetch = async (url) => {
        return {
            ok: false,
            status: 404,
            statusText: 'Not Found'
        };
    };
    const res3 = await loadChildMapData('test3', 1);
    assert.equal(res3.id, 'test3');
    assert.equal(res3.name, 'test3');
    assert.equal(Boolean(res3.error), true);

    // 4. Other error case
    global.fetch = async (url) => {
        return {
            ok: false,
            status: 500,
            statusText: 'Server Error'
        };
    };
    const res4 = await loadChildMapData('test4', 1);
    assert.equal(res4.id, 'test4');
    assert.equal(res4.name, 'test4');
    assert.equal(Boolean(res4.error), true);

    // 5. Fetch throw error case
    console.error = () => {}; // suppress errors
    global.fetch = async () => { throw new Error('Network Error'); };
    const res5 = await loadChildMapData('test5', 1);
    assert.equal(res5.id, 'test5');
    assert.equal(res5.name, 'test5');
    assert.equal(Boolean(res5.error), true);

    // restore console
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;

    console.log('loadChildMapData tests passed');
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
