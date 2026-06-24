const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionRange(startMarker, endMarker) {
    const start = appSource.indexOf(startMarker);
    if (start === -1) {
        throw new Error(`Could not find start marker: ${startMarker}`);
    }
    const end = appSource.indexOf(endMarker, start);
    if (end === -1) {
        throw new Error(`Could not find end marker: ${endMarker}`);
    }
    return appSource.slice(start, end);
}

global.MOBILE_SURFACE_MODE_SEARCH = 'search';
global.openMobileSheetCalls = [];
global.openMobileSheet = (options) => {
    global.openMobileSheetCalls.push(options);
};

// eslint-disable-next-line no-eval
eval(extractFunctionRange('function openMobileSearchPanel(', 'function closeMobileSearchPanel('));

const triggerButton = { id: 'mobile-search-launcher-btn' };

openMobileSearchPanel({ focusSearch: true, triggerButton });
assert.deepEqual(global.openMobileSheetCalls.pop(), {
    mode: 'search',
    focusSearch: true,
    triggerButton
});

openMobileSearchPanel();
assert.deepEqual(global.openMobileSheetCalls.pop(), {
    mode: 'search',
    focusSearch: false,
    triggerButton: null
});

console.log('openMobileSearchPanel delegation checks passed');
