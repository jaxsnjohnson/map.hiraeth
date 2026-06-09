const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function parseHash() {');
const fnEnd = appSource.indexOf('function getHistoryStateValue(state, key, fallbackValue) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate parseHash function in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

global.window = {
    location: {
        hash: ''
    }
};

// eslint-disable-next-line no-eval
eval(fnSource);

// Test empty hash
window.location.hash = '';
assert.deepEqual(parseHash(), { mapId: null, sidebarState: 'o' });

// Test mapId only
window.location.hash = '#map123';
assert.deepEqual(parseHash(), { mapId: 'map123', sidebarState: 'o' });

// Test mapId and sidebar open state
window.location.hash = '#map123-s=o';
assert.deepEqual(parseHash(), { mapId: 'map123', sidebarState: 'o' });

// Test mapId and sidebar closed state
window.location.hash = '#map123-s=c';
assert.deepEqual(parseHash(), { mapId: 'map123', sidebarState: 'c' });

// Test mapId and invalid sidebar state fallback
window.location.hash = '#map123-s=x';
assert.deepEqual(parseHash(), { mapId: 'map123', sidebarState: 'o' });

// Test missing mapId with sidebar closed state
window.location.hash = '#-s=c';
assert.deepEqual(parseHash(), { mapId: '', sidebarState: 'c' });

console.log('parseHash tests passed');
