const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const fnStart = appSource.indexOf('function renderEncounterTableList');
const fnEnd = appSource.indexOf('function initializeGMPillDrag');

if (fnStart === -1 || fnEnd === -1) {
    throw new Error('Could not find renderEncounterTableList');
}

const fnSource = appSource.slice(fnStart, fnEnd);

const tableEntries = [];
let appendChildCalls = 0;
const appendedNodes = [];

const createMockElement = (tag) => {
    return {
        tagName: tag,
        className: '',
        textContent: '',
        innerHTML: '',
        childNodes: [],
        appendChild: function(node) {
            this.childNodes.push(node);
        }
    };
};

const mockEncounterTableList = {
    innerHTML: '',
    appendChild: (node) => {
        appendedNodes.push(node);
        appendChildCalls++;
    }
};

const mockCurrentEncounterTablesById = {
    get: (id) => {
        if (id === 'test-table') {
            return { entries: tableEntries };
        }
        return null; // For 'empty-table' or non-existent
    }
};

const sandbox = {
    console: console,
    setTimeout: setTimeout,
    Object: Object,
    Array: Array,
    Math: Math,
    Promise: Promise,
    JSON: JSON,
    document: {
        createDocumentFragment: () => createMockElement('document-fragment'),
        createElement: createMockElement,
        createTextNode: (text) => ({ nodeType: 3, textContent: text }),
        addEventListener: () => {},
        querySelector: () => null,
        getElementById: () => null,
        documentElement: {
            classList: {
                add: () => {},
                remove: () => {},
                toggle: () => {}
            }
        }
    },
    window: {
        addEventListener: () => {},
        matchMedia: () => ({ matches: false, addEventListener: () => {} }),
        location: { search: '', hash: '' },
        history: { replaceState: () => {} }
    },
    MutationObserver: class { observe() {} disconnect() {} },
    encounterTableList: mockEncounterTableList,
    currentEncounterTablesById: mockCurrentEncounterTablesById,
    mapElement: null,
    gmPill: null,
    GM_STATE_STORAGE_KEY: 'mock_gm_state',
    localStorage: { getItem: () => null, setItem: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    safeGetStorage: () => null,
    safeSetStorage: () => {},
    L: { map: () => ({ setView: () => {} }) },
    navigator: { userAgent: '' }
};

vm.createContext(sandbox);

// Fallback to evaluating only the function if the full file requires too many mocks
vm.runInContext(fnSource, sandbox);

// Test 1: Empty table
// Note: When table is empty/null, renderEncounterTableList appends a "No encounter entries." node
appendedNodes.length = 0;
sandbox.renderEncounterTableList('empty-table');
assert.strictEqual(appendedNodes.length, 1);
assert.strictEqual(appendedNodes[0].textContent, 'No encounter entries.');

// Test 2: Table with normal entries
appendedNodes.length = 0;
tableEntries.length = 0;
tableEntries.push({ weight: 2, result: 'Goblin' });
sandbox.renderEncounterTableList('test-table');
assert.strictEqual(appendedNodes.length, 1);
const goblinNode = appendedNodes[0].childNodes[0];
assert.strictEqual(goblinNode.className, 'list-item');
assert.strictEqual(goblinNode.childNodes[0].textContent, 'x2');
assert.strictEqual(goblinNode.childNodes[0].className, 'encounter-weight');
assert.strictEqual(goblinNode.childNodes[1].textContent, ' Goblin');

// Test 3: Table with malicious XSS payload
appendedNodes.length = 0;
tableEntries.length = 0;
tableEntries.push({ weight: '<img src=x onerror=alert(1)>', result: '<script>alert("xss")</script>' });
sandbox.renderEncounterTableList('test-table');
assert.strictEqual(appendedNodes.length, 1);
const maliciousNode = appendedNodes[0].childNodes[0];
assert.strictEqual(maliciousNode.childNodes[0].textContent, 'x<img src=x onerror=alert(1)>');
assert.strictEqual(maliciousNode.childNodes[1].textContent, ' <script>alert("xss")</script>');
assert.strictEqual(maliciousNode.innerHTML, '', 'Should not use innerHTML');

console.log('renderEncounterTableList regression tests passed');
