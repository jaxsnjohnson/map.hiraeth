const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const fnStart = appSource.indexOf('function getVisibleEncounterTables(mapObj) {');
const fnEnd = appSource.indexOf('// --- DOM Elements ---');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate getVisibleEncounterTables function block in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

// Mock the GM visibility state dependency
let gmContentVisible = false;
function visibilityAllowed(item) {
    const vis = (item && item.visibility) ? String(item.visibility).toLowerCase() : 'public';
    return vis !== 'gm' || gmContentVisible;
}

// Evaluate production source
// eslint-disable-next-line no-eval
eval(fnSource);

// --- Test Cases ---

// 1. Missing or invalid encounterTables array
assert.deepEqual(getVisibleEncounterTables({}), []);
assert.deepEqual(getVisibleEncounterTables({ encounterTables: null }), []);
assert.deepEqual(getVisibleEncounterTables({ encounterTables: "not-an-array" }), []);

// 2. Map with basic public encounter tables
const basicMap = {
    encounterTables: [
        {
            name: "Forest Encounters",
            entries: [
                { roll: "1-5", description: "A friendly deer" },
                { roll: "6-10", description: "A hungry wolf" }
            ]
        }
    ]
};
assert.deepEqual(getVisibleEncounterTables(basicMap), basicMap.encounterTables);

// 3. GM content hidden
gmContentVisible = false;
const mixedMap = {
    encounterTables: [
        {
            name: "Public Table",
            entries: [
                { roll: "1-5", description: "Public entry" },
                { roll: "6-10", description: "Secret GM entry", visibility: "gm" }
            ]
        },
        {
            name: "GM Only Table",
            visibility: "gm",
            entries: [
                { roll: "1-10", description: "Super secret stuff" }
            ]
        }
    ]
};
const expectedMixedPublic = [
    {
        name: "Public Table",
        entries: [
            { roll: "1-5", description: "Public entry" }
        ]
    }
];
assert.deepEqual(getVisibleEncounterTables(mixedMap), expectedMixedPublic);

// 4. GM content visible
gmContentVisible = true;
assert.deepEqual(getVisibleEncounterTables(mixedMap), mixedMap.encounterTables);

// 5. Tables filtered out if all their entries are filtered out
gmContentVisible = false;
const mapWithEmptyTables = {
    encounterTables: [
        {
            name: "Table with only GM entries",
            entries: [
                { roll: "1-5", description: "GM 1", visibility: "gm" },
                { roll: "6-10", description: "GM 2", visibility: "gm" }
            ]
        },
        {
            name: "Table with no entries",
            entries: []
        },
        {
            name: "Valid public table",
            entries: [
                { roll: "1", description: "Public" }
            ]
        }
    ]
};
const expectedEmptyTablesFiltered = [
    {
        name: "Valid public table",
        entries: [
            { roll: "1", description: "Public" }
        ]
    }
];
assert.deepEqual(getVisibleEncounterTables(mapWithEmptyTables), expectedEmptyTablesFiltered);

console.log('getVisibleEncounterTables tests passed');
