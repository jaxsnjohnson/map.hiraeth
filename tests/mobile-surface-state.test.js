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

const snippets = [
    extractFunctionRange('function hasOpenMobileSurface(', 'mobileLayoutV2Enabled = resolveMobileLayoutV2Enabled();'),
    extractFunctionRange('function syncMobileSearchResultsCardState(', 'function resolveSearchScope('),
    extractFunctionRange('function syncMobileSearchPanelState(', 'function syncMobileFilterState(')
].join('\n');

global.MOBILE_SURFACE_MODE_ATLAS = 'atlas';
global.MOBILE_SURFACE_MODE_SEARCH = 'search';
global.isMobileLayoutActive = true;
global.mobileSurfaceMode = null;
global.lastMobileSurfaceTriggerButton = null;
global.currentSearchScope = 'map';
global.searchControlContainer = { style: { display: 'block' } };
global.searchResultsContainer = {
    style: { display: 'none' },
    innerHTML: ''
};
global.poiSearchInput = { focusCalled: 0, focus() { this.focusCalled += 1; } };
global.mobileSheetLauncherBtn = { focusCalled: 0, focus() { this.focusCalled += 1; } };
global.mobileSearchLauncherBtn = { focusCalled: 0, focus() { this.focusCalled += 1; } };
global.mobileSearchPanel = {
    attrs: {},
    dataset: {},
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.mobileSearchPanelTitle = { textContent: '' };
global.mobileSearchPanelCloseBtn = {
    attrs: {},
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.mobileSearchPanelSearchSlot = { hidden: false };
global.mobileMapListSection = { hidden: false };
global.mobileSearchResultsCard = { hidden: true };
global.mapBlurbElement = {
    innerHTML: '',
    classes: new Set(),
    classList: {
        contains(name) {
            return global.mapBlurbElement.classes.has(name);
        },
        toggle(name, active) {
            if (active) global.mapBlurbElement.classes.add(name);
            else global.mapBlurbElement.classes.delete(name);
        }
    }
};
global.toggleBlurbBtn = {
    attrs: {},
    classes: new Set(),
    classList: {
        toggle(name, active) {
            if (active) global.toggleBlurbBtn.classes.add(name);
            else global.toggleBlurbBtn.classes.delete(name);
        }
    },
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.mobileInfoHelpBtn = {
    attrs: {},
    classes: new Set(),
    classList: {
        toggle(name, active) {
            if (active) global.mobileInfoHelpBtn.classes.add(name);
            else global.mobileInfoHelpBtn.classes.delete(name);
        }
    },
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.container = {
    classes: new Set(),
    classList: {
        toggle(name, active) {
            if (active) global.container.classes.add(name);
            else global.container.classes.delete(name);
        }
    }
};
global.syncMobileDockState = () => {};
global.syncSidebarBackdropState = () => {};
global.setSearchScope = (scope) => { global.currentSearchScope = scope; };
global.requestAnimationFrame = (callback) => callback();
global.escapeHtml = (value) => String(value || '');
global.getMapRuntimeData = () => ({ name: 'Fallback', blurb: '<p>Fallback.</p>' });

// eslint-disable-next-line no-eval
eval(snippets);

assert.equal(hasOpenMobileSurface(), false);

openMobileSheet({ mode: 'atlas', triggerButton: global.mobileSheetLauncherBtn });
assert.equal(global.mobileSurfaceMode, 'atlas');
assert.equal(global.mobileSearchPanel.attrs['aria-hidden'], 'false');
assert.equal(global.mobileSearchPanel.dataset.mode, 'atlas');
assert.equal(global.mobileSearchPanelTitle.textContent, 'Atlas');
assert.equal(global.mobileSearchPanelCloseBtn.attrs['aria-label'], 'Close atlas');
assert.equal(global.mobileSearchPanelSearchSlot.hidden, true);
assert.equal(global.mobileMapListSection.hidden, false);
assert.equal(global.container.classes.has('mobile-search-panel-open'), true);
assert.equal(global.container.classes.has('mobile-surface-atlas'), true);

closeMobileSheet({ restoreFocus: true });
assert.equal(global.mobileSurfaceMode, null);
assert.equal(global.mobileSheetLauncherBtn.focusCalled, 1);
assert.equal(global.mobileSearchPanel.attrs['aria-hidden'], 'true');

global.searchResultsContainer.style.display = 'block';
global.searchResultsContainer.innerHTML = '<li>Result</li>';
openMobileSearchPanel({ focusSearch: true, triggerButton: global.mobileSearchLauncherBtn });
assert.equal(global.mobileSurfaceMode, 'search');
assert.equal(global.poiSearchInput.focusCalled, 1);
assert.equal(global.mobileSearchPanelTitle.textContent, 'Search');
assert.equal(global.mobileSearchPanelCloseBtn.attrs['aria-label'], 'Close search');
assert.equal(global.mobileSearchPanelSearchSlot.hidden, false);
assert.equal(global.mobileMapListSection.hidden, true);
assert.equal(global.mobileSearchResultsCard.hidden, false);
assert.equal(global.container.classes.has('mobile-surface-search'), true);

syncMobileMapMeta({ name: 'Eldran', blurb: '<p>Ruins.</p>' });
assert.match(global.mapBlurbElement.innerHTML, /Eldran/);
assert.match(global.mapBlurbElement.innerHTML, /Open Guide/);

setMapBlurbVisible(true);
assert.equal(global.toggleBlurbBtn.attrs['aria-expanded'], 'true');
assert.equal(global.mobileInfoHelpBtn.attrs['aria-expanded'], 'true');

closeMobileSheet({ restoreFocus: true });
assert.equal(global.mobileSurfaceMode, null);
assert.equal(global.mobileSearchLauncherBtn.focusCalled, 1);

global.isMobileLayoutActive = false;
openMobileSheet({ mode: 'atlas', triggerButton: global.mobileSheetLauncherBtn });
assert.equal(global.mobileSurfaceMode, null);

console.log('mobile surface state checks passed');
