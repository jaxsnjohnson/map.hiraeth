const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const appJsPath = path.resolve(__dirname, '../js/app.js');
const appJsCode = fs.readFileSync(appJsPath, 'utf8');

function extractFunctionSource(name) {
    const start = appJsCode.indexOf(`function ${name}(`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < appJsCode.length; i += 1) {
        const char = appJsCode[i];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }
    if (end === -1) {
        throw new Error(`Could not parse function ${name}`);
    }
    return appJsCode.slice(start, end);
}

const functionSource = extractFunctionSource('normalizeWheelDelta');
// Extract the constants required by the function
const constantsSource = `
const WHEEL_DELTA_LINE_HEIGHT = 16;
const WHEEL_DELTA_PAGE_HEIGHT = 240;
`;

const sandbox = {
    window: { innerHeight: 1000 },
    Math: Math,
    Number: Number,
    module: {}
};

vm.createContext(sandbox);
vm.runInContext(constantsSource + '\n' + functionSource + '\nmodule.exports = normalizeWheelDelta;', sandbox);
const normalizeWheelDelta = sandbox.module.exports;

test('normalizeWheelDelta', async (t) => {
    await t.test('deltaMode 0 (pixels)', () => {
        assert.equal(normalizeWheelDelta({ deltaY: 100, deltaMode: 0 }), 100);
        assert.equal(normalizeWheelDelta({ deltaY: -50, deltaMode: 0 }), -50);
    });

    await t.test('deltaMode 1 (lines)', () => {
        assert.equal(normalizeWheelDelta({ deltaY: 3, deltaMode: 1 }), 3 * 16);
    });

    await t.test('deltaMode 2 (pages) with window.innerHeight > WHEEL_DELTA_PAGE_HEIGHT', () => {
        sandbox.window.innerHeight = 1000;
        assert.equal(normalizeWheelDelta({ deltaY: 2, deltaMode: 2 }), 2 * 1000);
    });

    await t.test('deltaMode 2 (pages) with window.innerHeight < WHEEL_DELTA_PAGE_HEIGHT', () => {
        sandbox.window.innerHeight = 100;
        assert.equal(normalizeWheelDelta({ deltaY: 2, deltaMode: 2 }), 2 * 240);
    });

    await t.test('handles undefined window.innerHeight', () => {
        sandbox.window.innerHeight = undefined;
        assert.equal(normalizeWheelDelta({ deltaY: 2, deltaMode: 2 }), 2 * 240);
    });

    await t.test('handles missing deltaY or non-numeric deltaY', () => {
        assert.equal(normalizeWheelDelta({ deltaMode: 0 }), 0);
        assert.equal(normalizeWheelDelta({ deltaY: 'abc', deltaMode: 0 }), 0);
    });
});
