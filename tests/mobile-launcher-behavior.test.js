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

global.mobileSearchPanelOpen = false;
global.mobileMapsSheetOpen = false;
global.isMobileLayoutActive = true;
global.isEmbeddedView = false;
global.refreshLucideIcons = () => {};
global.mobileDock = {
    hidden: false
};
global.mobileExploreLauncherBtn = {
    hidden: false,
    innerHTML: '',
    attrs: {},
    classes: new Set(),
    classList: {
        toggle: (name, active) => {
            if (active) global.mobileExploreLauncherBtn.classes.add(name);
            else global.mobileExploreLauncherBtn.classes.delete(name);
        }
    },
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.mobileMapsLauncherBtn = {
    hidden: false,
    attrs: {},
    classes: new Set(),
    classList: {
        toggle: (name, active) => {
            if (active) global.mobileMapsLauncherBtn.classes.add(name);
            else global.mobileMapsLauncherBtn.classes.delete(name);
        }
    },
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};

syncMobileDockState();
assert.equal(global.mobileDock.hidden, false);
assert.equal(global.mobileExploreLauncherBtn.attrs['aria-label'], 'Open explore');
assert.equal(global.mobileExploreLauncherBtn.attrs['aria-pressed'], 'false');
assert.equal(global.mobileMapsLauncherBtn.hidden, false);
assert.equal(global.mobileMapsLauncherBtn.attrs['aria-label'], 'Open maps');
assert.equal(global.mobileMapsLauncherBtn.attrs['aria-pressed'], 'false');

global.mobileSearchPanelOpen = true;
syncMobileDockState();
assert.equal(global.mobileExploreLauncherBtn.attrs['aria-label'], 'Close explore');
assert.equal(global.mobileExploreLauncherBtn.attrs['aria-pressed'], 'true');
assert.equal(global.mobileMapsLauncherBtn.attrs['aria-label'], 'Open maps');
assert.equal(global.mobileMapsLauncherBtn.attrs['aria-pressed'], 'false');

global.mobileSearchPanelOpen = false;
global.mobileMapsSheetOpen = true;
syncMobileDockState();
assert.equal(global.mobileExploreLauncherBtn.attrs['aria-label'], 'Open explore');
assert.equal(global.mobileMapsLauncherBtn.attrs['aria-label'], 'Close maps');
assert.equal(global.mobileMapsLauncherBtn.attrs['aria-pressed'], 'true');

global.isEmbeddedView = true;
syncMobileDockState();
assert.equal(global.mobileDock.hidden, true);
assert.equal(global.mobileExploreLauncherBtn.hidden, true);
assert.equal(global.mobileMapsLauncherBtn.hidden, true);

console.log('mobile launcher behavior regression checks passed');
