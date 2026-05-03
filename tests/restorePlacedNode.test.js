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

// eslint-disable-next-line no-eval
eval(extractFunctionRange('function restorePlacedNode(anchor, element) {', 'function restoreMobileToolPanels() {'));

class MockNode {
    constructor(id) {
        this.id = id;
        this.parentNode = null;
        this.nextSibling = null;
        this.insertBeforeCalls = [];
    }

    insertBefore(element, nextSibling) {
        this.insertBeforeCalls.push({ element, nextSibling });
    }
}

// Case 1: anchor is null
restorePlacedNode(null, new MockNode('element'));

// Case 2: anchor.parentNode is null
restorePlacedNode(new MockNode('anchor'), new MockNode('element'));

// Case 3: element is null
const anchorNode3 = new MockNode('anchor');
anchorNode3.parentNode = new MockNode('parent');
restorePlacedNode(anchorNode3, null);

// Case 4: element is already correctly placed
const parentNode4 = new MockNode('parent');
const anchorNode4 = new MockNode('anchor');
const elementNode4 = new MockNode('element');

anchorNode4.parentNode = parentNode4;
elementNode4.parentNode = parentNode4;
anchorNode4.nextSibling = elementNode4;

restorePlacedNode(anchorNode4, elementNode4);
assert.equal(parentNode4.insertBeforeCalls.length, 0, 'Should not call insertBefore if element is already placed');

// Case 5: element needs to be placed
const parentNode5 = new MockNode('parent');
const anchorNode5 = new MockNode('anchor');
const nextSiblingNode5 = new MockNode('nextSibling');
const elementNode5 = new MockNode('element');

anchorNode5.parentNode = parentNode5;
anchorNode5.nextSibling = nextSiblingNode5;

restorePlacedNode(anchorNode5, elementNode5);

assert.equal(parentNode5.insertBeforeCalls.length, 1, 'Should call insertBefore once');
assert.equal(parentNode5.insertBeforeCalls[0].element, elementNode5, 'Should pass element as first arg to insertBefore');
assert.equal(parentNode5.insertBeforeCalls[0].nextSibling, nextSiblingNode5, 'Should pass anchor.nextSibling as second arg to insertBefore');
