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
    extractFunctionRange('function hasOpenMobileSurface(', 'function openMobileSheet('),
    extractFunctionRange('function openMobileSheet(', 'mobileLayoutV2Enabled = resolveMobileLayoutV2Enabled();'),
    extractFunctionRange('function syncMobileSearchPanelState(', 'function syncMobileFilterState(')
].join('\n');

global.isMobileLayoutActive = true;
global.mobileSearchPanelOpen = false;
global.mobileMapsExpanded = true;
global.currentSearchScope = 'map';
global.searchControlContainer = { style: { display: 'block' } };
global.mapListElement = {
    querySelectorAll() {
        return new Array(5).fill(null);
    }
};
global.poiSearchInput = { focusCalled: 0, focus() { this.focusCalled += 1; } };
global.mobileSheetLauncherBtn = { focusCalled: 0, focus() { this.focusCalled += 1; } };
global.mobileSearchPanel = { attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } };
global.mobileMapListSection = {
    hidden: false,
    classes: new Set(),
    classList: {
        toggle(name, active) {
            if (active) global.mobileMapListSection.classes.add(name);
            else global.mobileMapListSection.classes.delete(name);
        }
    }
};
global.mobileMapListToggleBtn = {
    hidden: false,
    textContent: '',
    attrs: {},
    setAttribute(name, value) {
        this.attrs[name] = value;
    }
};
global.mobileSearchPanelMapListShell = {
    hidden: false
};
global.mobileCurrentMapSummaryName = { textContent: '' };
global.mobileCurrentMapSummaryBlurb = { textContent: '' };
global.mobileMapListPreviewName = { textContent: '' };
global.mobileMapListPreviewMeta = { textContent: '' };
global.mobileSearchPanelTitle = { textContent: '' };
global.getMobileMapSummaryExcerpt = () => 'A windswept frontier with ruins.';
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

// eslint-disable-next-line no-eval
eval(snippets);

assert.equal(hasOpenMobileSurface(), false);

openMobileSearchPanel({ focusSearch: true });
assert.equal(global.mobileSearchPanelOpen, true);
assert.equal(global.mobileMapsExpanded, false);
assert.equal(global.poiSearchInput.focusCalled, 1);
assert.equal(global.mobileSearchPanel.attrs['aria-hidden'], 'false');
assert.equal(global.container.classes.has('mobile-search-panel-open'), true);

syncMobileMapMeta({ name: 'Eldran', blurb: 'A windswept frontier with ruins.' });
assert.equal(global.mobileSearchPanelTitle.textContent, 'Atlas');
assert.equal(global.mobileCurrentMapSummaryName.textContent, 'Eldran');
assert.equal(global.mobileMapListPreviewName.textContent, 'Eldran');
assert.equal(global.mobileMapListPreviewMeta.textContent, '5 maps available in the atlas.');

syncMobileExploreVisibility();
assert.equal(global.mobileSearchPanelMapListShell.hidden, true);
assert.equal(global.mobileMapListToggleBtn.attrs['aria-expanded'], 'false');
assert.equal(global.mobileMapListToggleBtn.textContent, 'Show Maps');

toggleMobileMapListExpanded();
assert.equal(global.mobileMapsExpanded, true);
assert.equal(global.mobileSearchPanelMapListShell.hidden, false);
assert.equal(global.mobileMapListSection.classes.has('expanded'), true);
assert.equal(global.mobileMapListToggleBtn.attrs['aria-expanded'], 'true');
assert.equal(global.mobileMapListToggleBtn.textContent, 'Hide Maps');

toggleMobileMapListExpanded();
assert.equal(global.mobileMapsExpanded, false);
assert.equal(global.mobileSearchPanelMapListShell.hidden, true);

closeMobileSearchPanel({ restoreFocus: true });
assert.equal(global.mobileSearchPanelOpen, false);
assert.equal(global.mobileSheetLauncherBtn.focusCalled, 1);
assert.equal(global.mobileSearchPanel.attrs['aria-hidden'], 'true');

openMobileSheet({ mode: 'maps' });
assert.equal(global.mobileSearchPanelOpen, true);
assert.equal(hasOpenMobileSurface(), true);

closeMobileSheet({ restoreFocus: true, target: 'all' });
assert.equal(global.mobileSearchPanelOpen, false);
assert.equal(global.mobileSheetLauncherBtn.focusCalled, 2);

global.isMobileLayoutActive = false;
openMobileSearchPanel({ focusSearch: true });
assert.equal(global.mobileSearchPanelOpen, false);

console.log('mobile surface state checks passed');
