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

function createPanelStyle() {
    return {
        maxHeight: '100px',
        top: '10px',
        right: '10px',
        left: '10px'
    };
}

function resetPanels() {
    global.routePanel = { style: createPanelStyle() };
    global.sessionToolkitPanel = { style: createPanelStyle() };
    global.gmPill = { style: createPanelStyle() };
}

resetPanels();
global.mobileLayoutV2Enabled = true;
global.isMobileLayoutActive = true;
clampFloatingPanels();
assert.equal(global.routePanel.style.maxHeight, '100px');

resetPanels();
global.mobileLayoutV2Enabled = false;
global.isMobileLayoutActive = false;
clampFloatingPanels();
assert.equal(global.routePanel.style.maxHeight, '100px');

resetPanels();
global.mobileLayoutV2Enabled = true;
global.isMobileLayoutActive = false;
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

global.routePanel = null;
global.sessionToolkitPanel = null;
global.gmPill = null;
global.mobileLayoutV2Enabled = true;
global.isMobileLayoutActive = false;
assert.doesNotThrow(() => clampFloatingPanels());

console.log('clampFloatingPanels tests passed');
