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
eval(extractFunctionRange('function syncMobileDockState(', 'function markControlTouch('));

global.MOBILE_SURFACE_MODE_ATLAS = 'atlas';
global.MOBILE_SURFACE_MODE_SEARCH = 'search';
global.mobileSurfaceMode = null;
global.isMobileSurfaceMode = (mode) => global.mobileSurfaceMode === mode;
global.isMobileLayoutActive = true;
global.isEmbeddedView = false;
global.refreshLucideIcons = () => {};
global.searchControlContainer = { style: { display: 'block' } };
global.mobileDock = {
    hidden: false
};
global.mobileSheetLauncherBtn = {
    hidden: false,
    innerHTML: '',
    attrs: {},
    classes: new Set(),
    classList: {
        toggle(name, active) {
            if (active) global.mobileSheetLauncherBtn.classes.add(name);
            else global.mobileSheetLauncherBtn.classes.delete(name);
        }
    },
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.mobileSearchLauncherBtn = {
    hidden: false,
    innerHTML: '',
    attrs: {},
    classes: new Set(),
    classList: {
        toggle(name, active) {
            if (active) global.mobileSearchLauncherBtn.classes.add(name);
            else global.mobileSearchLauncherBtn.classes.delete(name);
        }
    },
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.mobileInfoHelpBtn = {
    hidden: false
};

syncMobileDockState();
assert.equal(global.mobileDock.hidden, false);
assert.equal(global.mobileSheetLauncherBtn.hidden, false);
assert.equal(global.mobileSearchLauncherBtn.hidden, false);
assert.equal(global.mobileSheetLauncherBtn.attrs['aria-label'], 'Open atlas');
assert.equal(global.mobileSheetLauncherBtn.attrs['aria-pressed'], 'false');
assert.equal(global.mobileSearchLauncherBtn.attrs['aria-label'], 'Open search');
assert.equal(global.mobileSearchLauncherBtn.attrs['aria-pressed'], 'false');
assert.match(global.mobileSheetLauncherBtn.innerHTML, /Atlas/);
assert.match(global.mobileSearchLauncherBtn.innerHTML, /Search/);

global.mobileSurfaceMode = 'atlas';
syncMobileDockState();
assert.equal(global.mobileSheetLauncherBtn.attrs['aria-label'], 'Close atlas');
assert.equal(global.mobileSheetLauncherBtn.attrs['aria-pressed'], 'true');
assert.equal(global.mobileSearchLauncherBtn.attrs['aria-label'], 'Open search');
assert.equal(global.mobileSearchLauncherBtn.attrs['aria-pressed'], 'false');

global.mobileSurfaceMode = 'search';
syncMobileDockState();
assert.equal(global.mobileSheetLauncherBtn.attrs['aria-label'], 'Open atlas');
assert.equal(global.mobileSearchLauncherBtn.attrs['aria-label'], 'Close search');
assert.equal(global.mobileSearchLauncherBtn.attrs['aria-pressed'], 'true');
assert.match(global.mobileSearchLauncherBtn.innerHTML, /Close/);

global.searchControlContainer.style.display = 'none';
syncMobileDockState();
assert.equal(global.mobileSearchLauncherBtn.hidden, true);

global.isEmbeddedView = true;
syncMobileDockState();
assert.equal(global.mobileDock.hidden, true);
assert.equal(global.mobileSheetLauncherBtn.hidden, true);
assert.equal(global.mobileInfoHelpBtn.hidden, true);

console.log('mobile launcher behavior regression checks passed');
