const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractSource(startMarker, endMarker) {
    const start = appSource.indexOf(startMarker);
    const end = appSource.indexOf(endMarker, start);
    if (start === -1 || end === -1 || end <= start) {
        throw new Error(`Could not locate source from ${startMarker} to ${endMarker}`);
    }
    return appSource.slice(start, end);
}

const escapeHelperSource = extractSource('function escapeHtml(value) {', 'function sanitizeWikiLinkForHref(value) {');
const regionFilterHelperSource = extractSource('const regionGroupNestedCheckboxes = new WeakMap();', 'function populateRegionFilters');
const exported = {};

// eslint-disable-next-line no-eval
eval(`${escapeHelperSource}
${regionFilterHelperSource}
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

test('createRegionFilterGroupDOM keeps repeated values unique across groups', () => {
    const document = installDocument();
    const politicalGroup = exported.createRegionFilterGroupDOM('Political', ['Wasteland']);
    const geographicGroup = exported.createRegionFilterGroupDOM('Geographic', ['Wasteland']);
    document.getElementById('root').append(politicalGroup, geographicGroup);

    const checkboxes = Array.from(document.querySelectorAll('.region-type-filter'));
    const ids = checkboxes.map(checkbox => checkbox.id);
    assert.equal(new Set(ids).size, ids.length);
    checkboxes.forEach((checkbox) => {
        assert.equal(document.querySelector(`label[for="${checkbox.id}"]`)?.textContent, 'Wasteland');
    });
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
