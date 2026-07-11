const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionSource(name) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) throw new Error(`Could not find function ${name}`);
    let depth = 0;
    for (let index = start; index < appSource.length; index += 1) {
        if (appSource[index] === '{') depth += 1;
        if (appSource[index] === '}') {
            depth -= 1;
            if (depth === 0) return appSource.slice(start, index + 1);
        }
    }
    throw new Error(`Could not parse function ${name}`);
}

let getMapChooserRegionCount;
let formatMapChooserDate;
let getMapChooserEditedText;
// eslint-disable-next-line no-eval
eval(`getMapChooserRegionCount = ${extractFunctionSource('getMapChooserRegionCount')}`);
// eslint-disable-next-line no-eval
eval(`formatMapChooserDate = ${extractFunctionSource('formatMapChooserDate')}`);
// eslint-disable-next-line no-eval
eval(`getMapChooserEditedText = ${extractFunctionSource('getMapChooserEditedText')}`);

assert.equal(getMapChooserRegionCount({ regionCount: 7 }), 7);
assert.equal(getMapChooserRegionCount({ regionCount: '3' }), 3);
assert.equal(getMapChooserRegionCount({ regionCount: -1 }), 0);
assert.equal(getMapChooserRegionCount({ regionCount: 2.5 }), 0);
assert.equal(getMapChooserRegionCount({}), 0);

assert.equal(formatMapChooserDate('2026-07-08T12:00:00Z'), 'Jul 8, 2026');
assert.equal(formatMapChooserDate('2025-03-04'), 'Mar 4, 2025');
assert.equal(formatMapChooserDate('2025-02-31'), '');
assert.equal(formatMapChooserDate('not-a-date'), '');
assert.equal(getMapChooserEditedText({ updatedAt: '2026-07-08T12:00:00Z' }), 'Last edited: Jul 8, 2026');
assert.equal(getMapChooserEditedText({ lastEdited: '2025-03-04' }), 'Last edited: Mar 4, 2025');
assert.equal(getMapChooserEditedText({ modifiedAt: 'not-a-date' }), '');
assert.equal(getMapChooserEditedText({}), '');

const chooserCardSource = extractFunctionSource('createMapChooserCard');
assert.match(chooserCardSource, /Regions: \$\{getMapChooserRegionCount\(mapInfo\)\}/);
assert.match(chooserCardSource, /if \(edited\.textContent\) \{/);
assert.doesNotMatch(appSource, /atlasGeneratedAt/);
assert.doesNotMatch(chooserCardSource, /getMapDefinition|hydrateMapChooserCard/);
assert.doesNotMatch(appSource, /function hydrateMapChooserCard\(/);

console.log('map chooser metadata checks passed');
