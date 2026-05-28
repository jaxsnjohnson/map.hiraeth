const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const fnStart = appSource.indexOf('function setMapAtmosphere(');
const fnEnd = appSource.indexOf('function shouldAnimateThemeTransition(');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate setMapAtmosphere in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

let featureFlags = {};
let normalizeConfigCalls = [];
let applyAtmosphereCalls = 0;

global.getFeatureFlag = (key, fallback) => {
    return featureFlags.hasOwnProperty(key) ? featureFlags[key] : fallback;
};

global.normalizeAtmosphereConfig = (config) => {
    normalizeConfigCalls.push(config);
    return config === 'raw_config' ? 'normalized_config' : null;
};

global.applyAtmosphereLayer = () => {
    applyAtmosphereCalls++;
};

global.currentAtmosphereConfig = 'initial';

// eslint-disable-next-line no-eval
eval(fnSource);

function resetMocks() {
    featureFlags = {};
    normalizeConfigCalls = [];
    applyAtmosphereCalls = 0;
    global.currentAtmosphereConfig = 'initial';
}

// Test 1: Feature flag disabled
resetMocks();
featureFlags['atmosphere'] = false;
setMapAtmosphere('raw_config');

assert.strictEqual(global.currentAtmosphereConfig, null);
assert.strictEqual(applyAtmosphereCalls, 1);
assert.strictEqual(normalizeConfigCalls.length, 0);

// Test 2: Feature flag enabled
resetMocks();
featureFlags['atmosphere'] = true;
setMapAtmosphere('raw_config');

assert.strictEqual(global.currentAtmosphereConfig, 'normalized_config');
assert.strictEqual(applyAtmosphereCalls, 1);
assert.deepStrictEqual(normalizeConfigCalls, ['raw_config']);

// Test 3: Feature flag default (true)
resetMocks();
setMapAtmosphere('raw_config');

assert.strictEqual(global.currentAtmosphereConfig, 'normalized_config');
assert.strictEqual(applyAtmosphereCalls, 1);
assert.deepStrictEqual(normalizeConfigCalls, ['raw_config']);

console.log('All tests passed for setMapAtmosphere!');
