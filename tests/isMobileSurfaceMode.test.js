const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionSource(name, endSignature) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }
    const end = appSource.indexOf(endSignature, start);
    if (end === -1) {
        throw new Error(`Could not parse function ${name}`);
    }
    return appSource.slice(start, end);
}

const snippet = extractFunctionSource('isMobileSurfaceMode', 'function openMobileSheet(');

global.mobileSurfaceMode = null;

// eslint-disable-next-line no-eval
eval(snippet);

global.mobileSurfaceMode = 'atlas';
assert.equal(isMobileSurfaceMode('atlas'), true);
assert.equal(isMobileSurfaceMode('search'), false);

global.mobileSurfaceMode = 'search';
assert.equal(isMobileSurfaceMode('search'), true);
assert.equal(isMobileSurfaceMode('tools'), false);
assert.equal(isMobileSurfaceMode(''), false);
assert.equal(isMobileSurfaceMode(undefined), false);

global.mobileSurfaceMode = 'tools';
assert.equal(isMobileSurfaceMode('tools'), true);
assert.equal(isMobileSurfaceMode('atlas'), false);

global.mobileSurfaceMode = null;
assert.equal(isMobileSurfaceMode(null), true);
assert.equal(isMobileSurfaceMode('search'), false);

console.log('isMobileSurfaceMode checks passed');
