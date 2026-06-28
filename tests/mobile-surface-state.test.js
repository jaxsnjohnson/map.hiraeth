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
global.MOBILE_SURFACE_MODE_TOOLS = 'tools';
global.MOBILE_TOOLS_PANEL_TOOLKIT = 'toolkit';
global.MOBILE_TOOLS_PANEL_GM = 'gm';
global.isMobileLayoutActive = true;
global.mobileSurfaceMode = null;
global.mobileToolsPanelMode = null;
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
global.mobileToolsLauncherBtn = { focusCalled: 0, focus() { this.focusCalled += 1; } };
global.mobileSearchPanel = {
    attrs: {},
    dataset: {},
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.mobileSearchPanelTitle = { textContent: '' };
global.mobileToolsCard = {
    attrs: {},
    dataset: {},
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.mobileSearchPanelCloseBtn = {
    attrs: {},
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.mobileSearchPanelSearchSlot = { hidden: false };
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
    classes: new Set(['sidebar-collapsed']),
    classList: {
        toggle(name, active) {
            if (active) global.container.classes.add(name);
            else global.container.classes.delete(name);
        },
        contains(name) {
            return global.container.classes.has(name);
        }
    }
};
global.syncMobileDockState = () => {};
global.syncSidebarBackdropState = () => {};
global.setMobileToolsPanelMode = (mode = null) => { global.mobileToolsPanelMode = mode; };
global.setSidebarStateCalls = [];
global.setSidebarState = (state) => {
    global.setSidebarStateCalls.push(state);
    global.container.classList.toggle('sidebar-collapsed', state === 'c');
    syncMobileSearchPanelState();
};
global.setSearchScope = (scope) => { global.currentSearchScope = scope; };
global.requestAnimationFrame = (callback) => callback();
global.escapeHtml = (value) => String(value || '');
global.getMapRuntimeData = () => ({ name: 'Fallback', blurb: '<p>Fallback.</p>' });

// eslint-disable-next-line no-eval
eval(snippets);

assert.equal(hasOpenMobileSurface(), false);

openMobileSheet({ mode: 'atlas', triggerButton: global.mobileSheetLauncherBtn });
assert.equal(global.mobileSurfaceMode, 'atlas');
assert.equal(global.mobileSearchPanel.attrs['aria-hidden'], 'true');
assert.equal(global.mobileSearchPanel.dataset.mode, '');
assert.equal(global.mobileSearchPanelTitle.textContent, 'Search');
assert.equal(global.mobileSearchPanelCloseBtn.attrs['aria-label'], 'Close search');
assert.equal(global.mobileSearchPanelSearchSlot.hidden, true);
assert.equal(global.container.classes.has('mobile-search-card-open'), false);
assert.equal(global.container.classes.has('mobile-surface-atlas'), true);
assert.equal(global.container.classes.has('sidebar-collapsed'), false);
assert.deepEqual(global.setSidebarStateCalls, ['o']);

closeMobileSheet({ restoreFocus: true });
assert.equal(global.mobileSurfaceMode, null);
assert.equal(global.mobileSheetLauncherBtn.focusCalled, 1);
assert.equal(global.mobileSearchPanel.attrs['aria-hidden'], 'true');
assert.equal(global.mobileToolsCard.attrs['aria-hidden'], 'true');
assert.equal(global.container.classes.has('sidebar-collapsed'), true);
assert.deepEqual(global.setSidebarStateCalls, ['o', 'c']);

global.searchResultsContainer.style.display = 'block';
global.searchResultsContainer.innerHTML = '<li>Result</li>';
openMobileSearchPanel({ focusSearch: true, triggerButton: global.mobileSearchLauncherBtn });
assert.equal(global.mobileSurfaceMode, 'search');
assert.equal(global.poiSearchInput.focusCalled, 1);
assert.equal(global.mobileSearchPanelTitle.textContent, 'Search');
assert.equal(global.mobileSearchPanelCloseBtn.attrs['aria-label'], 'Close search');
assert.equal(global.mobileSearchPanel.attrs['aria-hidden'], 'false');
assert.equal(global.mobileToolsCard.attrs['aria-hidden'], 'true');
assert.equal(global.mobileSearchPanel.dataset.mode, 'search');
assert.equal(global.mobileSearchPanelSearchSlot.hidden, false);
assert.equal(global.mobileSearchResultsCard.hidden, false);
assert.equal(global.container.classes.has('mobile-surface-search'), true);
assert.equal(global.container.classes.has('mobile-search-card-open'), true);
assert.equal(global.container.classes.has('sidebar-collapsed'), true);

syncMobileMapMeta({ name: 'Eldran', blurb: '<p>Ruins.</p>' });
assert.match(global.mapBlurbElement.innerHTML, /Eldran/);
assert.match(global.mapBlurbElement.innerHTML, /Open Guide/);

closeMobileSheet({ restoreFocus: true });
assert.equal(global.mobileSurfaceMode, null);
assert.equal(global.mobileSearchLauncherBtn.focusCalled, 1);
assert.equal(global.mobileSearchPanel.attrs['aria-hidden'], 'true');

const searchFocusCountAfterSheetClose = global.mobileSearchLauncherBtn.focusCalled;
closeMobileSearchPanel({ restoreFocus: true });
assert.equal(global.mobileSurfaceMode, null);
assert.equal(global.mobileSearchLauncherBtn.focusCalled, searchFocusCountAfterSheetClose);

openMobileSearchPanel({ focusSearch: false, triggerButton: global.mobileSearchLauncherBtn });
assert.equal(global.mobileSurfaceMode, 'search');
closeMobileSearchPanel();
assert.equal(global.mobileSurfaceMode, null);
assert.equal(global.mobileSearchPanel.attrs['aria-hidden'], 'true');
assert.equal(global.container.classes.has('mobile-search-card-open'), false);
assert.equal(global.mobileSearchLauncherBtn.focusCalled, searchFocusCountAfterSheetClose);

openMobileSearchPanel({ focusSearch: false, triggerButton: global.mobileSearchLauncherBtn });
closeMobileSearchPanel({ restoreFocus: true });
assert.equal(global.mobileSurfaceMode, null);
assert.equal(global.mobileSearchLauncherBtn.focusCalled, searchFocusCountAfterSheetClose + 1);

openMobileToolsPanel({
    panelMode: null,
    triggerButton: global.mobileToolsLauncherBtn
});
assert.equal(global.mobileSurfaceMode, 'tools');
assert.equal(global.mobileToolsPanelMode, null);
assert.equal(global.mobileSearchPanel.attrs['aria-hidden'], 'true');
assert.equal(global.mobileToolsCard.attrs['aria-hidden'], 'false');
assert.equal(global.container.classes.has('mobile-tools-card-open'), true);
assert.equal(global.container.classes.has('mobile-surface-tools'), true);

closeMobileSheet({ restoreFocus: true });
assert.equal(global.mobileSurfaceMode, null);
assert.equal(global.mobileToolsPanelMode, null);
assert.equal(global.mobileToolsLauncherBtn.focusCalled, 1);
assert.equal(global.mobileToolsCard.attrs['aria-hidden'], 'true');

openMobileSearchPanel({ focusSearch: false, triggerButton: global.mobileSearchLauncherBtn });
setMapBlurbVisible(true);
assert.equal(global.mobileSurfaceMode, null);
assert.equal(global.toggleBlurbBtn.attrs['aria-expanded'], 'true');
assert.equal(global.mobileInfoHelpBtn.attrs['aria-expanded'], 'true');
assert.equal(global.mobileSearchPanel.attrs['aria-hidden'], 'true');

global.isMobileLayoutActive = false;
openMobileSheet({ mode: 'atlas', triggerButton: global.mobileSheetLauncherBtn });
assert.equal(global.mobileSurfaceMode, null);

console.log('mobile surface state checks passed');
