const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const helperStart = appSource.indexOf('const regionGroupNestedCheckboxes = new WeakMap();');
const helperEnd = appSource.indexOf('function populateRegionFilters', helperStart);

if (helperStart === -1 || helperEnd === -1 || helperEnd <= helperStart) {
    throw new Error('Could not locate region filter group helpers in js/app.js');
}

const helperSource = appSource.slice(helperStart, helperEnd);
const exported = {};

// eslint-disable-next-line no-eval
eval(`${helperSource}
exported.createRegionFilterGroupDOM = createRegionFilterGroupDOM;
exported.getRegionGroupNestedCheckboxes = getRegionGroupNestedCheckboxes;
exported.setRegionGroupChildCheckboxes = setRegionGroupChildCheckboxes;`);

function installDocument() {
    const { window } = new JSDOM('<!doctype html><div id="root"></div>');
    global.document = window.document;
    return window.document;
}

test('createRegionFilterGroupDOM registers child checkboxes for parent toggles', () => {
    installDocument();

    const groupContainer = exported.createRegionFilterGroupDOM('Terrain', ['Forest', 'River', 'Mountain']);
    const groupCheckbox = groupContainer.querySelector('.region-group-filter');
    const domCheckboxes = Array.from(groupContainer.querySelectorAll('.region-type-filter'));
    const mappedCheckboxes = exported.getRegionGroupNestedCheckboxes(groupCheckbox);

    assert.equal(mappedCheckboxes.length, 3);
    assert.deepEqual(mappedCheckboxes, domCheckboxes);
    assert.deepEqual(mappedCheckboxes.map(checkbox => checkbox.value), ['Forest', 'River', 'Mountain']);

    exported.setRegionGroupChildCheckboxes(groupCheckbox, false);
    assert.deepEqual(mappedCheckboxes.map(checkbox => checkbox.checked), [false, false, false]);

    exported.setRegionGroupChildCheckboxes(groupCheckbox, true);
    assert.deepEqual(mappedCheckboxes.map(checkbox => checkbox.checked), [true, true, true]);
});

test('setRegionGroupChildCheckboxes falls back for compatible unregistered DOM', () => {
    const document = installDocument();
    const groupContainer = document.createElement('div');
    groupContainer.className = 'filter-group';
    groupContainer.innerHTML = `
        <input type="checkbox" class="region-group-filter" value="Terrain">
        <input type="checkbox" class="region-type-filter" data-group="Terrain" checked>
        <input type="checkbox" class="region-type-filter" data-group="Terrain" checked>
        <input type="checkbox" class="region-type-filter" data-group="Other" checked>
    `;
    document.getElementById('root').appendChild(groupContainer);

    const groupCheckbox = groupContainer.querySelector('.region-group-filter');
    const terrainCheckboxes = Array.from(groupContainer.querySelectorAll('[data-group="Terrain"]'));
    const otherCheckbox = groupContainer.querySelector('[data-group="Other"]');

    exported.setRegionGroupChildCheckboxes(groupCheckbox, false);

    assert.deepEqual(terrainCheckboxes.map(checkbox => checkbox.checked), [false, false]);
    assert.equal(otherCheckbox.checked, true);
});
