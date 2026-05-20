const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

const setupIdx = appJs.indexOf("function setupKeyboardAndModalLogic() {");
const setupEndIdx = appJs.indexOf("async function loadMapData() {");
const block = appJs.slice(setupIdx, setupEndIdx);

// Mock the global environment to test the extracted functions
global.document = {
    activeElement: { tagName: 'BODY', focus: () => {} }, // added focus
    addEventListener: () => {},
    getElementById: (id) => {
        if (id === 'about-modal') return global.aboutModal;
        return {
            addEventListener: () => {},
            classList: { add: () => {}, remove: () => {} }
        };
    },
    querySelectorAll: () => []
};

global.aboutModal = {
    classList: {
        contains: (cls) => global.aboutModalVisible && cls === 'visible',
        add: () => { global.aboutModalVisible = true; },
        remove: () => { global.aboutModalVisible = false; }
    },
    style: { display: 'none' },
    addEventListener: () => {},
    querySelector: () => ({ focus: () => {} }) // mock focusTarget for toggleAboutModal
};

global.aboutModalVisible = false;

global.map = {
    zoomIn: () => { global.mapZoomedIn = true; },
    zoomOut: () => { global.mapZoomedOut = true; },
    closePopup: () => { global.popupClosed = true; },
    getPanes: () => ({ popupPane: { firstChild: global.hasPopup } })
};
global.hasPopup = false;
global.mapZoomedIn = false;
global.mapZoomedOut = false;
global.popupClosed = false;

global.toggleBtn = { click: () => { global.sidebarToggled = true; } };
global.sidebarToggled = false;

global.themeToggle = { click: () => { global.themeToggled = true; } };
global.themeToggled = false;

global.measureToolBtn = { style: { display: 'block' }, click: () => { global.measureToggled = true; } };
global.measureToggled = false;

global.toggleMarkersBtn = { style: { display: 'block' }, click: () => { global.markersToggled = true; } };
global.markersToggled = false;

global.toggleFiltersBtn = { style: { display: 'block' }, click: () => { global.filtersToggled = true; } };
global.filtersToggled = false;

global.searchControlContainer = { style: { display: 'block' } };
global.poiSearchInput = { focus: () => { global.searchFocused = true; }, blur: () => { global.searchBlurred = true; } };
global.searchFocused = false;
global.searchBlurred = false;

global.isMobileLayoutActive = false;
global.mobileSearchLauncherBtn = null;
global.openMobileSheet = () => { global.mobileSheetOpened = true; };
global.mobileSheetOpened = false;
global.MOBILE_SURFACE_MODE_SEARCH = 'SEARCH';

global.filtersPanelVisible = false;
global.toggleFilterPanel = () => { global.filtersPanelToggled = true; };
global.filtersPanelToggled = false;

global.searchResultsContainer = { style: { display: 'none' } };
global.closeSearchResults = () => { global.searchResultsClosed = true; };
global.searchResultsClosed = false;

global.isMeasuringMultiPoint = false;
global.finalizeMultiPointMeasure = () => { global.multiPointCanceled = true; };
global.multiPointCanceled = false;

global.trackAnalytics = () => {};
global.safeSetStorage = () => {};
global.unlockAdvancedControls = () => {};
global.setOnboardingVisibility = () => {};
global.UX_STORAGE_KEYS = { onboardingSeen: 'seen' };
global.relaySharedContext = () => {};
global.hideShareRelayPrompt = () => {};

// Missing UI elements referenced in the setup block
global.onboardingOpenHelpBtn = null;
global.onboardingDismissBtn = null;
global.shareRelayActionBtn = null;
global.shareRelayDismissBtn = null;

// Variables from block
global.lastFocus = null;

let addedListener = null;
document.addEventListener = (evt, fn) => {
    if (evt === 'keydown' && fn.toString().includes('handleHelpShortcut')) {
        addedListener = fn;
    }
};

global.window = {
    requestAnimationFrame: (cb) => cb(),
    setTimeout: (cb) => cb()
};
global.requestAnimationFrame = global.window.requestAnimationFrame;
const origSetTimeout = global.setTimeout;
global.setTimeout = global.window.setTimeout;

// Evaluate the block
eval(block + "\nsetupKeyboardAndModalLogic();");

// Create test events
const createEvent = (key, ctrlKey = false, metaKey = false) => {
    let prevented = false;
    return {
        key,
        ctrlKey,
        metaKey,
        preventDefault: () => { prevented = true; },
        isPrevented: () => prevented
    };
};

assert.ok(addedListener, "Keydown listener should have been added");

// Test ? shortcut
let evt = createEvent('?');
addedListener(evt);
assert.ok(evt.isPrevented());
assert.ok(global.aboutModalVisible);

// Test Escape closing about modal
evt = createEvent('Escape');
addedListener(evt);
assert.ok(evt.isPrevented());
assert.ok(!global.aboutModalVisible);

// Test + shortcut
evt = createEvent('+');
addedListener(evt);
assert.ok(evt.isPrevented());
assert.ok(global.mapZoomedIn);

// Test - shortcut
evt = createEvent('-');
addedListener(evt);
assert.ok(evt.isPrevented());
assert.ok(global.mapZoomedOut);

// Test s shortcut
evt = createEvent('s');
addedListener(evt);
assert.ok(evt.isPrevented());
assert.ok(global.sidebarToggled);

// Test / shortcut
evt = createEvent('/');
addedListener(evt);
assert.ok(evt.isPrevented());
assert.ok(global.searchFocused);

// Test Ctrl+F shortcut
global.searchFocused = false;
evt = createEvent('f', true, false);
addedListener(evt);
assert.ok(evt.isPrevented());
assert.ok(global.searchFocused);

// Test input focused ignore
document.activeElement = { tagName: 'INPUT' };
evt = createEvent('t');
addedListener(evt);
assert.ok(!evt.isPrevented());
assert.ok(!global.themeToggled);

console.log('All shortcut tests passed!');
global.setTimeout = origSetTimeout;
