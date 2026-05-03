const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

// Use function signatures instead of hardcoded comments for resilience
const fnStart = appSource.indexOf('const DEFAULT_MAP_BACKGROUND_COLORS = {');
const fnEnd = appSource.indexOf('function getVisiblePoints(');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate functions in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

global.getConfigValue = (key, fallback) => fallback;
global.currentEffectiveTheme = 'light';
global.currentMapUnderlay = null;

// eslint-disable-next-line no-eval
eval(fnSource);

// Keep track of calls to setStyle
let lastStyleSet = null;

global.currentMapUnderlay = {
    setStyle: (style) => {
        lastStyleSet = style;
    }
};

// Test 1: currentMapUnderlay is null
global.currentMapUnderlay = null;
assert.doesNotThrow(() => updateMapUnderlayColor({ backgroundColor: '#ff0000' }));
assert.equal(lastStyleSet, null);

// Reset currentMapUnderlay
global.currentMapUnderlay = {
    setStyle: (style) => {
        lastStyleSet = style;
    }
};

// Test 2: mapEntry has backgroundColor
lastStyleSet = null;
updateMapUnderlayColor({ backgroundColor: ' #00ff00 ' });
assert.deepEqual(lastStyleSet, { fillColor: '#00ff00', color: '#00ff00' });

// Test 3: mapEntry is null, theme is light
lastStyleSet = null;
global.currentEffectiveTheme = 'light';
updateMapUnderlayColor(null);
assert.deepEqual(lastStyleSet, { fillColor: '#f4f0eb', color: '#f4f0eb' });

// Test 4: mapEntry does not have backgroundColor, theme is dark
lastStyleSet = null;
global.currentEffectiveTheme = 'dark';
updateMapUnderlayColor({});
assert.deepEqual(lastStyleSet, { fillColor: '#050510', color: '#050510' });

// Test 5: mapEntry has empty string backgroundColor
lastStyleSet = null;
global.currentEffectiveTheme = 'light';
updateMapUnderlayColor({ backgroundColor: '  ' });
assert.deepEqual(lastStyleSet, { fillColor: '#f4f0eb', color: '#f4f0eb' });

console.log('updateMapUnderlayColor tests passed');
