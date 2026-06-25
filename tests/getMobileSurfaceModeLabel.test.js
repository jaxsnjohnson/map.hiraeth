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

const snippet = extractFunctionSource('getMobileSurfaceModeLabel', 'function isMobileSurfaceMode(');

global.MOBILE_SURFACE_MODE_ATLAS = 'atlas';
global.MOBILE_SURFACE_MODE_SEARCH = 'search';
global.MOBILE_SURFACE_MODE_TOOLS = 'tools';
global.mobileSurfaceMode = null;

// eslint-disable-next-line no-eval
eval(snippet);

assert.equal(getMobileSurfaceModeLabel('atlas'), 'atlas');
assert.equal(getMobileSurfaceModeLabel('tools'), 'tools');
assert.equal(getMobileSurfaceModeLabel('search'), 'search');

assert.equal(getMobileSurfaceModeLabel('unknown'), 'search');
assert.equal(getMobileSurfaceModeLabel(''), 'search');
assert.equal(getMobileSurfaceModeLabel(null), 'search');

global.mobileSurfaceMode = 'atlas';
assert.equal(getMobileSurfaceModeLabel(), 'atlas');
assert.equal(getMobileSurfaceModeLabel(undefined), 'atlas');

global.mobileSurfaceMode = 'tools';
assert.equal(getMobileSurfaceModeLabel(), 'tools');

global.mobileSurfaceMode = 'search';
assert.equal(getMobileSurfaceModeLabel(), 'search');

global.mobileSurfaceMode = 'unexpected';
assert.equal(getMobileSurfaceModeLabel(), 'search');

console.log('getMobileSurfaceModeLabel checks passed');
