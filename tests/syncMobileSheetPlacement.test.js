const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionSource(name, endSignature) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }
    const end = appSource.indexOf(endSignature, start);
    if (end === -1) {
        throw new Error(`Could not parse function ${name}`);
    }
    return appSource.slice(start, end);
}

const snippets = extractFunctionSource('syncMobileSheetPlacement', 'function syncMobileSearchResultsCardState() {');

// Setup required constants from js/app.js
global.MOBILE_SURFACE_MODE_TOOLS = 'tools';

// Setup required global state variables
global.isMobileLayoutActive = false;
global.mobileSurfaceMode = null;
global.mobileToolsPanelMode = null;

// Mock function call trackers
let called_syncMobileSearchResultsCardState = 0;
let called_setMobileToolsPanelMode = null;
let called_restorePlacedNode = [];
let called_restoreMobileToolPanels = 0;

// Mock functions
global.syncMobileSearchResultsCardState = () => { called_syncMobileSearchResultsCardState += 1; };
global.setMobileToolsPanelMode = (mode) => { called_setMobileToolsPanelMode = mode; };
global.restorePlacedNode = (anchor, element) => { called_restorePlacedNode.push({anchor, element}); };
global.restoreMobileToolPanels = () => { called_restoreMobileToolPanels += 1; };

class MockNode {
    constructor(id) {
        this.id = id;
        this.parentNode = null;
        this.children = [];
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.children = child.parentNode.children.filter(c => c !== child);
        }
        child.parentNode = this;
        this.children.push(child);
    }
}

// Global DOM references
global.mobileSearchPanelSearchSlot = null;
global.mobileSearchPanelResultsSlot = null;
global.searchControlContainer = null;
global.poiFilterContainer = null;
global.searchResultsContainer = null;
global.mobileSearchControlAnchor = null;
global.mobileSearchResultsAnchor = null;
global.mobileFilterAnchor = null;

// Evaluate the function
// eslint-disable-next-line no-eval
eval(snippets);

function resetState() {
    called_syncMobileSearchResultsCardState = 0;
    called_setMobileToolsPanelMode = null;
    called_restorePlacedNode = [];
    called_restoreMobileToolPanels = 0;

    global.isMobileLayoutActive = false;
    global.mobileSurfaceMode = null;
    global.mobileToolsPanelMode = null;

    global.mobileSearchPanelSearchSlot = new MockNode('mobileSearchPanelSearchSlot');
    global.mobileSearchPanelResultsSlot = new MockNode('mobileSearchPanelResultsSlot');

    global.searchControlContainer = new MockNode('searchControlContainer');
    global.poiFilterContainer = new MockNode('poiFilterContainer');
    global.searchResultsContainer = new MockNode('searchResultsContainer');

    global.mobileSearchControlAnchor = new MockNode('mobileSearchControlAnchor');
    global.mobileSearchResultsAnchor = new MockNode('mobileSearchResultsAnchor');
    global.mobileFilterAnchor = new MockNode('mobileFilterAnchor');
}

// Test case 1: isMobileLayoutActive is true, components are appended
resetState();
global.isMobileLayoutActive = true;
global.mobileSurfaceMode = global.MOBILE_SURFACE_MODE_TOOLS;
global.mobileToolsPanelMode = 'some_tool';

syncMobileSheetPlacement();

assert.equal(global.searchControlContainer.parentNode, global.mobileSearchPanelSearchSlot);
assert.equal(global.poiFilterContainer.parentNode, global.mobileSearchPanelSearchSlot);
assert.equal(global.searchResultsContainer.parentNode, global.mobileSearchPanelResultsSlot);
assert.equal(called_syncMobileSearchResultsCardState, 1);
assert.equal(called_setMobileToolsPanelMode, 'some_tool');
assert.equal(called_restorePlacedNode.length, 0);
assert.equal(called_restoreMobileToolPanels, 0);

// Test case 2: isMobileLayoutActive is true, surface mode is not tools
resetState();
global.isMobileLayoutActive = true;
global.mobileSurfaceMode = 'search';
global.mobileToolsPanelMode = 'some_tool';

syncMobileSheetPlacement();
assert.equal(called_setMobileToolsPanelMode, null);

// Test case 3: isMobileLayoutActive is false, components are restored
resetState();
global.isMobileLayoutActive = false;

syncMobileSheetPlacement();

assert.equal(called_restorePlacedNode.length, 3);
assert.deepEqual(called_restorePlacedNode[0], { anchor: global.mobileSearchControlAnchor, element: global.searchControlContainer });
assert.deepEqual(called_restorePlacedNode[1], { anchor: global.mobileSearchResultsAnchor, element: global.searchResultsContainer });
assert.deepEqual(called_restorePlacedNode[2], { anchor: global.mobileFilterAnchor, element: global.poiFilterContainer });
assert.equal(called_setMobileToolsPanelMode, null);
assert.equal(called_restoreMobileToolPanels, 1);
assert.equal(called_syncMobileSearchResultsCardState, 1);

// Test case 4: Missing DOM elements (graceful handling)
resetState();
global.isMobileLayoutActive = true;
global.mobileSearchPanelSearchSlot = null;
global.searchControlContainer = null;
global.poiFilterContainer = null;
global.mobileSearchPanelResultsSlot = null;
global.searchResultsContainer = null;

// Should not throw
syncMobileSheetPlacement();
assert.equal(called_syncMobileSearchResultsCardState, 1);

// Test case 5: DOM elements already have correct parent (skip appendChild)
resetState();
global.isMobileLayoutActive = true;

// Pre-append them
global.mobileSearchPanelSearchSlot.appendChild(global.searchControlContainer);
global.mobileSearchPanelSearchSlot.appendChild(global.poiFilterContainer);
global.mobileSearchPanelResultsSlot.appendChild(global.searchResultsContainer);

// Track if appendChild is called again
let appendCalled = 0;
const originalAppend1 = global.mobileSearchPanelSearchSlot.appendChild;
const originalAppend2 = global.mobileSearchPanelResultsSlot.appendChild;

global.mobileSearchPanelSearchSlot.appendChild = (child) => { appendCalled++; originalAppend1.call(global.mobileSearchPanelSearchSlot, child); };
global.mobileSearchPanelResultsSlot.appendChild = (child) => { appendCalled++; originalAppend2.call(global.mobileSearchPanelResultsSlot, child); };

syncMobileSheetPlacement();

assert.equal(appendCalled, 0);

console.log('syncMobileSheetPlacement checks passed');
