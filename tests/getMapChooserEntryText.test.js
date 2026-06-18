const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const fnStart = appSource.indexOf('function getMapChooserEntryText(item) {');
const fnEnd = appSource.indexOf('function isMapChooserArchiveEntry(item, ancestors = []) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate getMapChooserEntryText in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

(function() {
    let getMapChooserEntryText;
    // eslint-disable-next-line no-eval
    eval(`getMapChooserEntryText = ${fnSource}`);

    // Test 1: returns empty string for missing or empty input
    assert.equal(getMapChooserEntryText(null), '');
    assert.equal(getMapChooserEntryText({}), '');
    assert.equal(getMapChooserEntryText({ id: '  ' }), '');

    // Test 2: combines all properties
    assert.equal(getMapChooserEntryText({ id: 'A', name: 'B', group: 'C', category: 'D' }), 'A B C D');

    // Test 3: ignores undefined/null properties
    assert.equal(getMapChooserEntryText({ id: 'A', group: 'C' }), 'A C');

    // Test 4: trims whitespace from properties
    assert.equal(getMapChooserEntryText({ id: ' A ', name: '  B  ' }), 'A B');

    // Test 5: stringifies non-string truthy properties, ignores falsy ones due to value || '' fallback and Boolean filter
    assert.equal(getMapChooserEntryText({ id: 123, name: null, group: false }), '123');
})();

console.log('getMapChooserEntryText unit tests passed');