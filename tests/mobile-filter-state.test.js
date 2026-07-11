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
    extractFunctionRange('function syncFilterPanelInteractionState(', 'function syncMobileDockState('),
    extractFunctionRange('function toggleFilterPanel(', 'toggleFiltersBtn.addEventListener(')
].join('\n');

// eslint-disable-next-line no-eval
eval(snippets);

global.isMobileLayoutActive = true;
global.mobileFilterExpanded = false;
global.filtersPanelVisible = false;
global.mobileSurfaceMode = 'atlas';
global.MOBILE_SURFACE_MODE_SEARCH = 'search';
global.isMobileSurfaceMode = (mode) => global.mobileSurfaceMode === mode;
global.container = {
    classes: new Set(),
    classList: {
        toggle(name, active) {
            if (active) global.container.classes.add(name);
            else global.container.classes.delete(name);
        }
    }
};
global.searchRefineFiltersBtn = {
    textContent: '',
    attrs: {},
    classes: new Set(),
    classList: {
        toggle(name, active) {
            if (active) global.searchRefineFiltersBtn.classes.add(name);
            else global.searchRefineFiltersBtn.classes.delete(name);
        }
    },
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.openMobileSheetCalls = [];
global.openMobileSheet = (args) => {
    global.openMobileSheetCalls.push(args);
    global.mobileSurfaceMode = args.mode;
};
global.mobileSearchLauncherBtn = { id: 'mobile-search-launcher-btn' };
global.poiFilterContainer = {
    inert: false,
    attrs: {},
    classes: new Set(),
    classList: {
        toggle(name, active) {
            if (active) global.poiFilterContainer.classes.add(name);
            else global.poiFilterContainer.classes.delete(name);
        }
    },
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.toggleFiltersBtn = {
    title: '',
    attrs: {},
    classes: new Set(),
    classList: {
        toggle(name, active) {
            if (active) global.toggleFiltersBtn.classes.add(name);
            else global.toggleFiltersBtn.classes.delete(name);
        }
    },
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.UX_STORAGE_KEYS = { filterPanelOpen: 'filterPanelOpen' };
global.safeSetStorage = () => {};
global.positionFilterPanel = () => {};
global.clampFloatingPanels = () => {};
global.updateActiveFilterChips = () => {};
global.trackAnalytics = () => {};

syncMobileFilterState();
assert.equal(global.container.classes.has('mobile-filters-open'), false);
assert.equal(global.searchRefineFiltersBtn.textContent, 'Filters');
assert.equal(global.searchRefineFiltersBtn.attrs['aria-pressed'], 'false');
assert.equal(global.searchRefineFiltersBtn.attrs['aria-expanded'], 'false');
assert.equal(global.poiFilterContainer.inert, true);
assert.equal(global.poiFilterContainer.attrs['aria-hidden'], 'true');

global.mobileFilterExpanded = true;
global.filtersPanelVisible = true;
syncMobileFilterState();
assert.equal(global.container.classes.has('mobile-filters-open'), true);
assert.equal(global.searchRefineFiltersBtn.textContent, 'Hide Filters');
assert.equal(global.searchRefineFiltersBtn.attrs['aria-pressed'], 'true');
assert.equal(global.searchRefineFiltersBtn.attrs['aria-expanded'], 'true');
assert.equal(global.poiFilterContainer.inert, false);
assert.equal(global.poiFilterContainer.attrs['aria-hidden'], 'false');

global.mobileFilterExpanded = false;
global.filtersPanelVisible = false;
global.mobileSurfaceMode = 'atlas';
toggleFilterPanel();
assert.deepEqual(global.openMobileSheetCalls, [{
    mode: 'search',
    focusSearch: false,
    triggerButton: global.mobileSearchLauncherBtn
}]);
assert.equal(global.mobileSurfaceMode, 'search');
assert.equal(global.filtersPanelVisible, true);
assert.equal(global.mobileFilterExpanded, true);
assert.equal(global.poiFilterContainer.classes.has('visible'), true);
assert.equal(global.toggleFiltersBtn.attrs['aria-expanded'], true);
assert.equal(global.toggleFiltersBtn.title, 'Hide Filters');

toggleFilterPanel();
assert.equal(global.openMobileSheetCalls.length, 1);
assert.equal(global.filtersPanelVisible, false);
assert.equal(global.mobileFilterExpanded, false);
assert.equal(global.poiFilterContainer.classes.has('visible'), false);
assert.equal(global.toggleFiltersBtn.title, 'Show Filters');

console.log('mobile filter state checks passed');
