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

const snippets = [
    extractFunctionSource('hasDirectMapHash')
].join('\n');

// eslint-disable-next-line no-eval
eval(snippets);

test('hasDirectMapHash', async (t) => {

    await t.test('returns true for a standard map ID', () => {
        assert.equal(hasDirectMapHash('capital-city'), true);
    });

    await t.test('returns true for strings with spaces that are not just whitespace', () => {
        assert.equal(hasDirectMapHash('  old-town  '), true);
    });

    await t.test('returns false for undefined', () => {
        assert.equal(hasDirectMapHash(undefined), false);
    });

    await t.test('returns false for null', () => {
        assert.equal(hasDirectMapHash(null), false);
    });

    await t.test('returns false for an empty string', () => {
        assert.equal(hasDirectMapHash(''), false);
    });

    await t.test('returns false for a string containing only whitespace', () => {
        assert.equal(hasDirectMapHash('   '), false);
        assert.equal(hasDirectMapHash('\t\n'), false);
    });

    await t.test('returns true for a non-string value that coerces to a non-empty string', () => {
        // Technically it coerces to '123' which trims to '123'
        assert.equal(hasDirectMapHash(123), true);
    });
});
