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

const snippets = extractFunctionSource('syncMobileToolPanelButtonState');

// Setup required constants from js/app.js
global.MOBILE_SURFACE_MODE_TOOLS = 'tools';
global.MOBILE_TOOLS_PANEL_TOOLKIT = 'toolkit';
global.MOBILE_TOOLS_PANEL_GM = 'gm';

// Setup required global state variables
global.isMobileLayoutActive = false;
global.mobileSurfaceMode = null;
global.mobileToolsPanelMode = null;

// Mock DOM elements
class MockButton {
    constructor() {
        this.classes = new Set();
        this.attributes = new Map();

        this.classList = {
            toggle: (className, force) => {
                if (force) {
                    this.classes.add(className);
                } else if (force === false) {
                    this.classes.delete(className);
                } else {
                    if (this.classes.has(className)) {
                        this.classes.delete(className);
                    } else {
                        this.classes.add(className);
                    }
                }
            },
            contains: (className) => this.classes.has(className)
        };
    }

    setAttribute(name, value) {
        this.attributes.set(name, value);
    }

    getAttribute(name) {
        return this.attributes.get(name);
    }
}

global.mobileToolkitBtn = new MockButton();
global.mobileGmViewBtn = new MockButton();

// Evaluate the function
// eslint-disable-next-line no-eval
eval(snippets);

// Helper to reset button state before each test
function resetButtons() {
    global.mobileToolkitBtn = new MockButton();
    global.mobileGmViewBtn = new MockButton();
}

// Test case 1: mobileToolkitBtn should be active
resetButtons();
global.isMobileLayoutActive = true;
global.mobileSurfaceMode = global.MOBILE_SURFACE_MODE_TOOLS;
global.mobileToolsPanelMode = global.MOBILE_TOOLS_PANEL_TOOLKIT;

syncMobileToolPanelButtonState();

assert.equal(global.mobileToolkitBtn.classList.contains('active'), true);
assert.equal(global.mobileToolkitBtn.getAttribute('aria-pressed'), 'true');

assert.equal(global.mobileGmViewBtn.classList.contains('active'), false);
assert.equal(global.mobileGmViewBtn.getAttribute('aria-pressed'), 'false');

// Test case 2: mobileGmViewBtn should be active
resetButtons();
global.isMobileLayoutActive = true;
global.mobileSurfaceMode = global.MOBILE_SURFACE_MODE_TOOLS;
global.mobileToolsPanelMode = global.MOBILE_TOOLS_PANEL_GM;

syncMobileToolPanelButtonState();

assert.equal(global.mobileToolkitBtn.classList.contains('active'), false);
assert.equal(global.mobileToolkitBtn.getAttribute('aria-pressed'), 'false');

assert.equal(global.mobileGmViewBtn.classList.contains('active'), true);
assert.equal(global.mobileGmViewBtn.getAttribute('aria-pressed'), 'true');

// Test case 3: isMobileLayoutActive is false (all buttons inactive)
resetButtons();
global.isMobileLayoutActive = false;
global.mobileSurfaceMode = global.MOBILE_SURFACE_MODE_TOOLS;
global.mobileToolsPanelMode = global.MOBILE_TOOLS_PANEL_TOOLKIT;

syncMobileToolPanelButtonState();

assert.equal(global.mobileToolkitBtn.classList.contains('active'), false);
assert.equal(global.mobileToolkitBtn.getAttribute('aria-pressed'), 'false');

assert.equal(global.mobileGmViewBtn.classList.contains('active'), false);
assert.equal(global.mobileGmViewBtn.getAttribute('aria-pressed'), 'false');

// Test case 4: mobileSurfaceMode is not 'tools' (all buttons inactive)
resetButtons();
global.isMobileLayoutActive = true;
global.mobileSurfaceMode = 'search'; // Anything other than 'tools'
global.mobileToolsPanelMode = global.MOBILE_TOOLS_PANEL_TOOLKIT;

syncMobileToolPanelButtonState();

assert.equal(global.mobileToolkitBtn.classList.contains('active'), false);
assert.equal(global.mobileToolkitBtn.getAttribute('aria-pressed'), 'false');

assert.equal(global.mobileGmViewBtn.classList.contains('active'), false);
assert.equal(global.mobileGmViewBtn.getAttribute('aria-pressed'), 'false');

// Test case 5: button elements are null (function should safely exit without throwing errors)
resetButtons();
global.mobileToolkitBtn = null;
global.mobileGmViewBtn = null;
global.isMobileLayoutActive = true;
global.mobileSurfaceMode = global.MOBILE_SURFACE_MODE_TOOLS;
global.mobileToolsPanelMode = global.MOBILE_TOOLS_PANEL_TOOLKIT;

// This should run without throwing an error
syncMobileToolPanelButtonState();

console.log('syncMobileToolPanelButtonState checks passed');
