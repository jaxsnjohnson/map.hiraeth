const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

// Extract the target function and its dependencies
const fnStart = appSource.indexOf('const DEFAULT_MAP_BACKGROUND_COLORS = {');
const fnEnd = appSource.indexOf('function updateMapUnderlayColor(');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate getMapBackgroundColor in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

// Mock globals required by the extracted code
global.getConfigValue = (key, fallback) => fallback;
global.currentEffectiveTheme = 'light';

// Evaluate the function source in the local scope
// eslint-disable-next-line no-eval
eval(fnSource);

// --- Test Cases ---

// Test 1: returns the backgroundColor from mapEntry if provided
let result = getMapBackgroundColor({ backgroundColor: '#aabbcc' });
assert.equal(result, '#aabbcc');

// Test 2: trims whitespace from the backgroundColor
result = getMapBackgroundColor({ backgroundColor: '  #ddeeff  ' });
assert.equal(result, '#ddeeff');

// Test 3: returns light theme default when no mapEntry provided and theme is light
global.currentEffectiveTheme = 'light';
result = getMapBackgroundColor();
assert.equal(result, '#f4f0eb'); // DEFAULT_MAP_BACKGROUND_COLORS.light

// Test 4: returns light theme default when mapEntry lacks backgroundColor and theme is light
global.currentEffectiveTheme = 'light';
result = getMapBackgroundColor({});
assert.equal(result, '#f4f0eb');

// Test 5: returns dark theme default when no mapEntry provided and theme is dark
global.currentEffectiveTheme = 'dark';
result = getMapBackgroundColor(null);
assert.equal(result, '#050510'); // DEFAULT_MAP_BACKGROUND_COLORS.dark

// Test 6: returns dark theme default when mapEntry has empty string backgroundColor and theme is dark
global.currentEffectiveTheme = 'dark';
result = getMapBackgroundColor({ backgroundColor: '   ' });
assert.equal(result, '#050510');

// Test 7: Handles custom configured values
global.getConfigValue = (key, fallback) => {
    if (key === 'theme.mapBackgroundColors') {
        return { light: '#customLight', dark: '#customDark' };
    }
    return fallback;
};
// Re-evaluate to pickup new mock
eval(fnSource);

global.currentEffectiveTheme = 'light';
result = getMapBackgroundColor(null);
assert.equal(result, '#customLight');

global.currentEffectiveTheme = 'dark';
result = getMapBackgroundColor({});
assert.equal(result, '#customDark');

// Test 8: returns default colors when getConfigValue is undefined
global.getConfigValue = undefined;
eval(fnSource); // Re-evaluate so configuredMapBackgroundColors falls back to DEFAULT_MAP_BACKGROUND_COLORS

global.currentEffectiveTheme = 'light';
result = getMapBackgroundColor(null);
assert.equal(result, '#f4f0eb'); // DEFAULT_MAP_BACKGROUND_COLORS.light

global.currentEffectiveTheme = 'dark';
result = getMapBackgroundColor(null);
assert.equal(result, '#050510'); // DEFAULT_MAP_BACKGROUND_COLORS.dark

console.log('getMapBackgroundColor tests passed');
