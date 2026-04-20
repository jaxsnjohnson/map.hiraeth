const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionRange(startMarker, endMarker) {
    const start = appSource.indexOf(startMarker);
    if (start === -1) {
        throw new Error(`Could not find start marker: ${startMarker}`);
    }
    const end = endMarker ? appSource.indexOf(endMarker, start) : appSource.length;
    if (end === -1) {
        throw new Error(`Could not find end marker: ${endMarker}`);
    }
    return appSource.slice(start, end);
}

const snippet = extractFunctionRange('function clampFloatingPanels(', 'function shouldShowMiniMap(');

// eslint-disable-next-line no-eval
eval(snippet);

global.mobileLayoutV2Enabled = true;
global.isMobileLayoutActive = false;

global.routePanel = { style: { maxHeight: '220px', top: '20px', right: '10px', left: '30px' } };
global.sessionToolkitPanel = { style: { maxHeight: '180px', top: '40px', right: '12px', left: '32px' } };
global.gmPill = { style: { maxHeight: '120px', top: '60px', right: '14px', left: '34px' } };
global.poiFilterContainer = { style: { maxHeight: '320px', top: '80px', right: '16px', left: '120px' } };

clampFloatingPanels();

assert.deepEqual(global.routePanel.style, {
    maxHeight: '',
    top: '',
    right: '',
    left: ''
});
assert.deepEqual(global.sessionToolkitPanel.style, {
    maxHeight: '',
    top: '',
    right: '',
    left: ''
});
assert.deepEqual(global.gmPill.style, {
    maxHeight: '',
    top: '',
    right: '',
    left: ''
});
assert.deepEqual(global.poiFilterContainer.style, {
    maxHeight: '320px',
    top: '80px',
    right: '16px',
    left: '120px'
});

console.log('desktop filter panel positioning checks passed');
