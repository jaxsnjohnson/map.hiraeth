const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const startMarker = "function setAuxPanelVisible(panelEl, visible, displayMode = 'block') {";
const endMarker = 'function updatePanelToggleButtons() {';

const start = appSource.indexOf(startMarker);
const end = appSource.indexOf(endMarker, start);

if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate setAuxPanelVisible in js/app.js');
}

const snippet = appSource.slice(start, end);

// Global mocks
global.isMobileLayoutActive = false;
global.routePanel = { id: 'routePanel', style: {} };
global.sessionToolkitPanel = { id: 'sessionToolkitPanel', style: {} };
global.gmPill = { id: 'gmPill', style: {} };
global.mobileToolsPanelSlot = { id: 'mobileToolsPanelSlot' };
global.MOBILE_SURFACE_MODE_TOOLS = 'tools';
global.mobileSurfaceMode = null;

global.isMobileSurfaceMode = function (mode) {
    return global.mobileSurfaceMode === mode;
};

// Evaluate the snippet
// eslint-disable-next-line no-eval
eval(snippet);

// Test 1: Early return if panelEl is falsy
assert.doesNotThrow(() => {
    setAuxPanelVisible(null, true);
});
assert.doesNotThrow(() => {
    setAuxPanelVisible(undefined, true);
});

// Test 2: Desktop layout - visible
global.isMobileLayoutActive = false;
const desktopPanel1 = { style: {} };
setAuxPanelVisible(desktopPanel1, true);
assert.equal(desktopPanel1.style.display, 'block');

// Test 3: Desktop layout - hidden
const desktopPanel2 = { style: {} };
setAuxPanelVisible(desktopPanel2, false);
assert.equal(desktopPanel2.style.display, 'none');

// Test 4: Desktop layout - custom display mode
const desktopPanel3 = { style: {} };
setAuxPanelVisible(desktopPanel3, true, 'flex');
assert.equal(desktopPanel3.style.display, 'flex');

// Test 5: Mobile layout - non-special panel
global.isMobileLayoutActive = true;
const mobileNonSpecialPanel = { style: {} };
setAuxPanelVisible(mobileNonSpecialPanel, true);
assert.equal(mobileNonSpecialPanel.style.display, 'block');
setAuxPanelVisible(mobileNonSpecialPanel, false);
assert.equal(mobileNonSpecialPanel.style.display, 'none');

// Test 6: Mobile layout - special panel, mounted in tools, tools mode active, visible
global.isMobileLayoutActive = true;
global.mobileSurfaceMode = 'tools'; // isMobileSurfaceMode(MOBILE_SURFACE_MODE_TOOLS) -> true
global.routePanel.parentNode = global.mobileToolsPanelSlot;
global.routePanel.style.display = '';
setAuxPanelVisible(global.routePanel, true);
assert.equal(global.routePanel.style.display, 'block');

// Test 7: Mobile layout - special panel, mounted in tools, tools mode active, hidden
global.routePanel.style.display = '';
setAuxPanelVisible(global.routePanel, false);
assert.equal(global.routePanel.style.display, 'none');

// Test 8: Mobile layout - special panel, not mounted in tools
global.mobileSurfaceMode = 'tools'; // tools mode active
const someOtherNode = { id: 'someOtherNode' };
global.routePanel.parentNode = someOtherNode; // not mobileToolsPanelSlot
global.routePanel.style.display = '';
setAuxPanelVisible(global.routePanel, true);
assert.equal(global.routePanel.style.display, 'none'); // fails condition mountedInMobileTools
setAuxPanelVisible(global.routePanel, false);
assert.equal(global.routePanel.style.display, 'none');

// Test 9: Mobile layout - special panel, mounted in tools, tools mode NOT active
global.mobileSurfaceMode = 'atlas'; // tools mode not active
global.routePanel.parentNode = global.mobileToolsPanelSlot;
global.routePanel.style.display = '';
setAuxPanelVisible(global.routePanel, true);
assert.equal(global.routePanel.style.display, 'none'); // fails isMobileSurfaceMode check
setAuxPanelVisible(global.routePanel, false);
assert.equal(global.routePanel.style.display, 'none');

// Test 10: Mobile layout - test all special panels
global.isMobileLayoutActive = true;
global.mobileSurfaceMode = 'tools';
global.routePanel.parentNode = global.mobileToolsPanelSlot;
global.sessionToolkitPanel.parentNode = global.mobileToolsPanelSlot;
global.gmPill.parentNode = global.mobileToolsPanelSlot;

setAuxPanelVisible(global.routePanel, true);
assert.equal(global.routePanel.style.display, 'block');

setAuxPanelVisible(global.sessionToolkitPanel, true);
assert.equal(global.sessionToolkitPanel.style.display, 'block');

setAuxPanelVisible(global.gmPill, true);
assert.equal(global.gmPill.style.display, 'block');

console.log('setAuxPanelVisible regression checks passed');
