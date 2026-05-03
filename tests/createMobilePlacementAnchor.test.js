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

const snippet = extractFunctionRange(
    'function createMobilePlacementAnchor(element) {',
    'const mobileSearchControlAnchor ='
);

// eslint-disable-next-line no-eval
eval(snippet);

// Mock document.createElement
global.document = {
    createElement(tag) {
        return {
            tagName: tag,
            hidden: false,
            attributes: {},
            setAttribute(key, val) {
                this.attributes[key] = val;
            },
            className: ''
        };
    }
};

// Happy path
const parentNode = {
    insertBefore(newChild, refChild) {
        this.insertedNode = newChild;
        this.refNode = refChild;
    }
};

const element = { parentNode };

const anchor = createMobilePlacementAnchor(element);

assert.ok(anchor, 'should return an anchor element');
assert.equal(anchor.tagName, 'span', 'anchor should be a span element');
assert.equal(anchor.hidden, true, 'anchor should be hidden');
assert.equal(anchor.attributes['aria-hidden'], 'true', 'anchor should have aria-hidden true');
assert.equal(anchor.className, 'mobile-placement-anchor', 'anchor should have the correct class name');

assert.equal(parentNode.insertedNode, anchor, 'anchor should be inserted into parent node');
assert.equal(parentNode.refNode, element, 'anchor should be inserted before the original element');

// Edge cases
assert.equal(createMobilePlacementAnchor(null), null, 'should return null if element is falsy');
assert.equal(createMobilePlacementAnchor({}), null, 'should return null if element has no parentNode');

console.log('createMobilePlacementAnchor regression checks passed');
