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

const snippets = [
    extractFunctionSource('normalizeMobileLayoutMode'),
    extractFunctionSource('getUrlParameters'),
    extractFunctionSource('getMobileLayoutModeFromUrl'),
    extractFunctionSource('resolveMobileLayoutV2Enabled')
].join('\n');

const storage = new Map();
global.localStorage = {
    getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
        storage.set(key, String(value));
    }
};
global.UX_STORAGE_KEYS = { mobileLayoutMode: 'mobileLayoutMode' };
global.MOBILE_LAYOUT_MODE_V2 = 'v2';
global.MOBILE_LAYOUT_MODE_LEGACY = 'legacy';
global.MOBILE_LAYOUT_QUERY_PARAM = 'mobileLayout';
global.safeGetStorage = (key) => global.localStorage.getItem(key);
global.safeSetStorage = (key, value) => global.localStorage.setItem(key, value);

// eslint-disable-next-line no-eval
eval(snippets);

global.window = { location: { search: '?mobileLayout=v2' } };
assert.equal(resolveMobileLayoutV2Enabled(), true);
assert.equal(storage.get('mobileLayoutMode'), 'v2');

global.window = { location: { search: '?mobileLayout=legacy' } };
assert.equal(resolveMobileLayoutV2Enabled(), false);
assert.equal(storage.get('mobileLayoutMode'), 'legacy');

global.window = { location: { search: '' } };
storage.set('mobileLayoutMode', 'legacy');
assert.equal(resolveMobileLayoutV2Enabled(), false);

storage.delete('mobileLayoutMode');
assert.equal(resolveMobileLayoutV2Enabled(), true);
assert.equal(storage.get('mobileLayoutMode'), 'v2');

console.log('mobile layout mode helper checks passed');
