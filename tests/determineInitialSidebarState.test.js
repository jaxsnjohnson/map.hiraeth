const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function determineInitialSidebarState(hashSidebarState, initialMapIdFromHash = \'\') {');
const fnEnd = appSource.indexOf('function handleMapChooserInitialization() {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate determineInitialSidebarState function in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);
const UX_STORAGE_KEYS = { sidebarState: 'sidebarState' };
let storedSidebarState = null;

function safeGetStorage(key) {
    return key === UX_STORAGE_KEYS.sidebarState ? storedSidebarState : null;
}

function hasDirectMapHash(mapId) {
    return !!String(mapId || '').trim();
}

global.window = {
    location: {
        hash: ''
    }
};

// eslint-disable-next-line no-eval
eval(fnSource);

storedSidebarState = 'o';
window.location.hash = '#main_continent';
assert.equal(determineInitialSidebarState('o', 'main_continent'), 'o');

storedSidebarState = 'o';
window.location.hash = '#main_continent-s=o';
assert.equal(determineInitialSidebarState('o', 'main_continent'), 'o');

storedSidebarState = 'o';
window.location.hash = '#main_continent-s=c';
assert.equal(determineInitialSidebarState('c', 'main_continent'), 'c');

storedSidebarState = 'c';
window.location.hash = '';
assert.equal(determineInitialSidebarState('o', ''), 'c');

storedSidebarState = null;
window.location.hash = '';
assert.equal(determineInitialSidebarState('o', ''), 'o');

storedSidebarState = 'c';
window.location.hash = '#main_continent';
assert.equal(determineInitialSidebarState('o', 'main_continent'), 'c');

console.log('determineInitialSidebarState regression checks passed');
