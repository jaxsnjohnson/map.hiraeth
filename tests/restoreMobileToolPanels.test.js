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

const restoreMobileToolPanelsSource = extractFunctionRange('function restoreMobileToolPanels() {', 'function syncMobileToolPanelButtonState(');

class MockPanel {
    constructor(id) {
        this.id = id;
        this.removedClasses = [];
        this.classList = {
            remove: (className) => {
                this.removedClasses.push(className);
            }
        };
    }
}

class MockAnchor {
    constructor(id) {
        this.id = id;
    }
}

global.sessionToolkitPanel = new MockPanel('sessionToolkitPanel');
global.gmPill = new MockPanel('gmPill');

global.mobileToolkitPanelAnchor = new MockAnchor('mobileToolkitPanelAnchor');
global.mobileGmPillAnchor = new MockAnchor('mobileGmPillAnchor');

const restorePlacedNodeCalls = [];
global.restorePlacedNode = function(anchor, element) {
    restorePlacedNodeCalls.push({ anchor, element });
};

// eslint-disable-next-line no-eval
eval(restoreMobileToolPanelsSource);

restoreMobileToolPanels();

assert.equal(restorePlacedNodeCalls.length, 2, 'restorePlacedNode should be called 2 times');

assert.equal(restorePlacedNodeCalls[0].anchor, global.mobileToolkitPanelAnchor);
assert.equal(restorePlacedNodeCalls[0].element, global.sessionToolkitPanel);

assert.equal(restorePlacedNodeCalls[1].anchor, global.mobileGmPillAnchor);
assert.equal(restorePlacedNodeCalls[1].element, global.gmPill);

assert.deepEqual(global.sessionToolkitPanel.removedClasses, ['mobile-tools-mounted']);
assert.deepEqual(global.gmPill.removedClasses, ['mobile-tools-mounted']);

// Test with missing panels
global.sessionToolkitPanel = null;
global.gmPill = null;
restorePlacedNodeCalls.length = 0;

restoreMobileToolPanels();

assert.equal(restorePlacedNodeCalls.length, 2);
assert.equal(restorePlacedNodeCalls[0].element, null);
assert.equal(restorePlacedNodeCalls[1].element, null);
console.log('restoreMobileToolPanels checks passed');
