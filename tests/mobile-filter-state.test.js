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
eval(extractFunctionRange('function syncMobileFilterState(', 'function syncMobileDockState('));

global.isMobileLayoutActive = true;
global.mobileFilterExpanded = false;
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

syncMobileFilterState();
assert.equal(global.container.classes.has('mobile-filters-open'), false);
assert.equal(global.searchRefineFiltersBtn.textContent, 'Filters');
assert.equal(global.searchRefineFiltersBtn.attrs['aria-pressed'], 'false');
assert.equal(global.searchRefineFiltersBtn.attrs['aria-expanded'], 'false');

global.mobileFilterExpanded = true;
syncMobileFilterState();
assert.equal(global.container.classes.has('mobile-filters-open'), true);
assert.equal(global.searchRefineFiltersBtn.textContent, 'Hide Filters');
assert.equal(global.searchRefineFiltersBtn.attrs['aria-pressed'], 'true');
assert.equal(global.searchRefineFiltersBtn.attrs['aria-expanded'], 'true');

console.log('mobile filter state checks passed');
