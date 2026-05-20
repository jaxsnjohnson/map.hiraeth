const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const fnStart = appSource.indexOf('function getMapChooserDescriptionText(mapInfo) {');
const fnEnd = appSource.indexOf('async function hydrateMapChooserCard(card, mapInfo) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate getMapChooserDescriptionText in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

// Wrap the test in an IIFE as per project memory
(function() {
    // Mock DOMParser
    class DOMParserMock {
        parseFromString(str, type) {
            // A simple mock for extracting text content from HTML tags
            const stripped = str.replace(/<[^>]*>/g, '');
            return {
                body: {
                    textContent: stripped,
                    innerText: stripped
                }
            };
        }
    }
    const origDOMParser = global.DOMParser;
    global.DOMParser = DOMParserMock;

    let getMapChooserDescriptionText;
    // eslint-disable-next-line no-eval
    eval(`getMapChooserDescriptionText = ${fnSource}`);

    // Test 1: returns empty string for missing or empty input
    assert.equal(getMapChooserDescriptionText(null), '');
    assert.equal(getMapChooserDescriptionText({}), '');
    assert.equal(getMapChooserDescriptionText({ selectorDescription: '  ' }), '');

    // Test 2: prioritizes fields correctly
    assert.equal(getMapChooserDescriptionText({ selectorDescription: 'A', summary: 'B' }), 'A');
    assert.equal(getMapChooserDescriptionText({ summary: 'B', description: 'C' }), 'B');
    assert.equal(getMapChooserDescriptionText({ description: 'C', blurb: 'D' }), 'C');
    assert.equal(getMapChooserDescriptionText({ blurb: 'D' }), 'D');

    // Test 3: parses HTML using DOMParser mock and returns text content
    assert.equal(getMapChooserDescriptionText({ summary: '<b>Bold</b> text' }), 'Bold text');
    assert.equal(getMapChooserDescriptionText({ summary: 'Look at this <img src="x" onerror="alert(1)"> image' }), 'Look at this  image');

    // Restore globals
    global.DOMParser = origDOMParser;
})();

console.log('getMapChooserDescriptionText unit tests passed');
