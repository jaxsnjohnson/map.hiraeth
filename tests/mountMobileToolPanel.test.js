const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionSource(name) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < appSource.length; i += 1) {
        const char = appSource[i];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }
    if (end === -1) {
        throw new Error(`Could not parse function ${name}`);
    }
    return appSource.slice(start, end);
}

const functionSource = extractFunctionSource('mountMobileToolPanel');

class MockElement {
    constructor(id) {
        this.id = id;
        this.classList = new Set();
        this.style = {};
        this.parentNode = null;
        this.children = [];
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        child.parentNode = this;
        this.children.push(child);
    }

    removeChild(child) {
        this.children = this.children.filter(c => c !== child);
        child.parentNode = null;
    }
}

let mobileToolsPanelSlot;

eval(functionSource);

// Test 1: Handle null panel or slot
mobileToolsPanelSlot = null;
assert.equal(mountMobileToolPanel(new MockElement('test')), false);

mobileToolsPanelSlot = new MockElement('slot');
assert.equal(mountMobileToolPanel(null), false);

// Test 2: Mount panel
let panel = new MockElement('panel');
assert.equal(mountMobileToolPanel(panel), true);
assert.equal(panel.parentNode, mobileToolsPanelSlot);
assert.equal(mobileToolsPanelSlot.children[0], panel);
assert.ok(panel.classList.has('mobile-tools-mounted'));
assert.equal(panel.style.display, 'block');

// Test 3: Mount panel with display mode
panel = new MockElement('panel');
assert.equal(mountMobileToolPanel(panel, 'flex'), true);
assert.equal(panel.style.display, 'flex');

// Test 4: Panel already mounted
let existingParent = new MockElement('other-parent');
existingParent.appendChild(panel);
assert.equal(panel.parentNode, existingParent);

assert.equal(mountMobileToolPanel(panel), true);
assert.equal(panel.parentNode, mobileToolsPanelSlot);
assert.equal(existingParent.children.length, 0);
assert.equal(mobileToolsPanelSlot.children[mobileToolsPanelSlot.children.length - 1], panel);

console.log('mountMobileToolPanel regression checks passed');
