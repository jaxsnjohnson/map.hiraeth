const assert = require('node:assert/strict');
const fs = require('node:fs');

const sharedUtilsSource = fs.readFileSync('js/shared-utils.js', 'utf8');

function extractFunctionSource(name) {
    const start = sharedUtilsSource.indexOf(`function ${name}(`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < sharedUtilsSource.length; i += 1) {
        const char = sharedUtilsSource[i];
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
    return sharedUtilsSource.slice(start, end);
}

const snippets = extractFunctionSource('withAssetVersion');

// eslint-disable-next-line no-eval
eval(snippets);

async function runTests() {
    console.log('Running withAssetVersion tests...');

    // Test 1: window is undefined (e.g. Node env) -> should default to version 0
    // We mock window to be undefined by default
    global.window = undefined;
    let url = withAssetVersion('test.json');
    assert.equal(url, 'test.json?v=0', 'Should default to v=0 when window is undefined');

    // Test 2: window exists but APP_ASSET_VERSION is not set
    global.window = {};
    url = withAssetVersion('test.json');
    assert.equal(url, 'test.json?v=0', 'Should default to v=0 when window.APP_ASSET_VERSION is undefined');

    // Test 3: window.APP_ASSET_VERSION is set
    global.window = { APP_ASSET_VERSION: '1.2.3' };
    url = withAssetVersion('test.json');
    assert.equal(url, 'test.json?v=1.2.3', 'Should append correct version when set');

    // Test 4: URL already has query parameters
    global.window = { APP_ASSET_VERSION: '4.5.6' };
    url = withAssetVersion('test.json?foo=bar');
    assert.equal(url, 'test.json?foo=bar&v=4.5.6', 'Should use & separator when url already has query parameters');

    // Test 5: APP_ASSET_VERSION contains characters needing encoding
    global.window = { APP_ASSET_VERSION: 'test version?&=' };
    url = withAssetVersion('test.json');
    assert.equal(url, 'test.json?v=test%20version%3F%26%3D', 'Should URL encode the version string');

    console.log('withAssetVersion tests passed');
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
