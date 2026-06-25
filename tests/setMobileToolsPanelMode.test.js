const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionRange(startMarker, endMarker) {
    const start = appSource.indexOf(startMarker);
    if (start === -1) {
        throw new Error(`Could not find start marker: ${startMarker}`);
    }
    const end = appSource.indexOf(endMarker, start);
    if (end === -1) {
        throw new Error(`Could not find end marker: ${endMarker}`);
    }
    return appSource.slice(start, end);
}

const mobileToolPanelSource = extractFunctionRange(
    'function restorePlacedNode(anchor, element) {',
    'function syncMobileSheetPlacement() {'
);

const MOBILE_SURFACE_MODE_TOOLS = 'tools';
const MOBILE_TOOLS_PANEL_ROUTES = 'routes';
const MOBILE_TOOLS_PANEL_TOOLKIT = 'toolkit';
const MOBILE_TOOLS_PANEL_GM = 'gm';

let routePanel;
let sessionToolkitPanel;
let gmPill;
let mobileRoutePanelAnchor;
let mobileToolkitPanelAnchor;
let mobileGmPillAnchor;
let mobileToolsPanelSlot;
let mobileRoutesBtn;
let mobileToolkitBtn;
let mobileGmViewBtn;
let isMobileLayoutActive;
let mobileSurfaceMode;
let mobileToolsPanelMode;

class MockElement {
    constructor(id) {
        this.id = id;
        this.children = [];
        this.parentNode = null;
        this.style = {};
        this.hidden = false;
        this.classes = new Set();
        this.attributes = new Map();
        this.classList = {
            add: (className) => {
                this.classes.add(className);
            },
            remove: (className) => {
                this.classes.delete(className);
            },
            contains: (className) => this.classes.has(className),
            toggle: (className, force) => {
                if (force) {
                    this.classes.add(className);
                } else {
                    this.classes.delete(className);
                }
            }
        };
    }

    get nextSibling() {
        if (!this.parentNode) return null;
        const index = this.parentNode.children.indexOf(this);
        if (index === -1) return null;
        return this.parentNode.children[index + 1] || null;
    }

    appendChild(child) {
        return this.insertBefore(child, null);
    }

    insertBefore(child, referenceChild) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        child.parentNode = this;
        const referenceIndex = referenceChild ? this.children.indexOf(referenceChild) : -1;
        if (referenceIndex === -1) {
            this.children.push(child);
        } else {
            this.children.splice(referenceIndex, 0, child);
        }
        return child;
    }

    removeChild(child) {
        this.children = this.children.filter((candidate) => candidate !== child);
        child.parentNode = null;
        return child;
    }

    setAttribute(name, value) {
        this.attributes.set(name, value);
    }

    getAttribute(name) {
        return this.attributes.get(name);
    }
}

// eslint-disable-next-line no-eval
eval(mobileToolPanelSource);

function resetState() {
    const desktopRoot = new MockElement('desktop-root');
    routePanel = new MockElement('route-panel');
    sessionToolkitPanel = new MockElement('session-toolkit-panel');
    gmPill = new MockElement('gm-pill');
    desktopRoot.appendChild(routePanel);
    desktopRoot.appendChild(sessionToolkitPanel);
    desktopRoot.appendChild(gmPill);

    mobileRoutePanelAnchor = new MockElement('mobile-route-panel-anchor');
    mobileToolkitPanelAnchor = new MockElement('mobile-toolkit-panel-anchor');
    mobileGmPillAnchor = new MockElement('mobile-gm-pill-anchor');
    desktopRoot.insertBefore(mobileRoutePanelAnchor, routePanel);
    desktopRoot.insertBefore(mobileToolkitPanelAnchor, sessionToolkitPanel);
    desktopRoot.insertBefore(mobileGmPillAnchor, gmPill);

    mobileToolsPanelSlot = new MockElement('mobile-tools-panel-slot');
    mobileToolsPanelSlot.hidden = true;
    mobileRoutesBtn = new MockElement('mobile-routes-btn');
    mobileToolkitBtn = new MockElement('mobile-toolkit-btn');
    mobileGmViewBtn = new MockElement('mobile-gm-view-btn');
    isMobileLayoutActive = true;
    mobileSurfaceMode = MOBILE_SURFACE_MODE_TOOLS;
    mobileToolsPanelMode = null;

    return { desktopRoot };
}

function assertButtonPressed(button, expected, label) {
    assert.equal(button.classList.contains('active'), expected, `${label} active state`);
    assert.equal(button.getAttribute('aria-pressed'), expected ? 'true' : 'false', `${label} aria-pressed`);
}

resetState();
setMobileToolsPanelMode(MOBILE_TOOLS_PANEL_ROUTES);

assert.equal(mobileToolsPanelMode, MOBILE_TOOLS_PANEL_ROUTES);
assert.equal(routePanel.parentNode, mobileToolsPanelSlot);
assert.equal(mobileToolsPanelSlot.children[0], routePanel);
assert.equal(routePanel.style.display, 'block');
assert.equal(sessionToolkitPanel.style.display, 'none');
assert.equal(gmPill.style.display, 'none');
assert.equal(routePanel.classList.contains('mobile-tools-mounted'), true);
assert.equal(mobileToolsPanelSlot.hidden, false);
assertButtonPressed(mobileRoutesBtn, true, 'routes button');
assertButtonPressed(mobileToolkitBtn, false, 'toolkit button');
assertButtonPressed(mobileGmViewBtn, false, 'GM button');

resetState();
setMobileToolsPanelMode(MOBILE_TOOLS_PANEL_ROUTES);
setMobileToolsPanelMode(MOBILE_TOOLS_PANEL_TOOLKIT);

assert.equal(mobileToolsPanelMode, null);
assert.equal(routePanel.style.display, 'none');
assert.equal(sessionToolkitPanel.style.display, 'none');
assert.equal(gmPill.style.display, 'none');
assert.equal(mobileToolsPanelSlot.hidden, true);
assertButtonPressed(mobileRoutesBtn, false, 'routes button after unsupported mode');
assertButtonPressed(mobileToolkitBtn, false, 'toolkit button after unsupported mode');
assertButtonPressed(mobileGmViewBtn, false, 'GM button after unsupported mode');

{
    const { desktopRoot } = resetState();
    sessionToolkitPanel.classList.add('mobile-tools-mounted');
    gmPill.classList.add('mobile-tools-mounted');
    setMobileToolsPanelMode(MOBILE_TOOLS_PANEL_ROUTES);

    isMobileLayoutActive = false;
    setMobileToolsPanelMode(MOBILE_TOOLS_PANEL_ROUTES);

    assert.equal(routePanel.parentNode, desktopRoot);
    assert.equal(mobileRoutePanelAnchor.nextSibling, routePanel);
    assert.equal(routePanel.classList.contains('mobile-tools-mounted'), false);
    assert.equal(sessionToolkitPanel.classList.contains('mobile-tools-mounted'), false);
    assert.equal(gmPill.classList.contains('mobile-tools-mounted'), false);
    assert.equal(mobileToolsPanelMode, MOBILE_TOOLS_PANEL_ROUTES);
    assertButtonPressed(mobileRoutesBtn, false, 'routes button while inactive');
}

{
    const { desktopRoot } = resetState();
    const strayParent = new MockElement('stray-parent');
    strayParent.appendChild(routePanel);
    routePanel.classList.add('mobile-tools-mounted');
    mobileToolsPanelSlot = null;

    setMobileToolsPanelMode(MOBILE_TOOLS_PANEL_ROUTES);

    assert.equal(routePanel.parentNode, desktopRoot);
    assert.equal(mobileRoutePanelAnchor.nextSibling, routePanel);
    assert.equal(strayParent.children.length, 0);
    assert.equal(routePanel.classList.contains('mobile-tools-mounted'), false);
    assertButtonPressed(mobileRoutesBtn, true, 'routes button without slot');
}

console.log('setMobileToolsPanelMode regression checks passed');
