const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const normalizeStart = appSource.indexOf('function normalizeMobileLayoutMode(');
const normalizeEnd = appSource.indexOf('function getMobileLayoutModeFromUrl()', normalizeStart);

assert.notEqual(normalizeStart, -1);
assert.notEqual(normalizeEnd, -1);

const normalizeSource = appSource.slice(normalizeStart, normalizeEnd);

let normalizeMobileLayoutModeRef;

eval(`
    const MOBILE_LAYOUT_MODE_V2 = 'v2';
    const MOBILE_LAYOUT_MODE_LEGACY = 'legacy';
    ${normalizeSource}
    normalizeMobileLayoutModeRef = normalizeMobileLayoutMode;
`);

describe('normalizeMobileLayoutMode', () => {
    it('returns supported layout modes unchanged', () => {
        assert.equal(normalizeMobileLayoutModeRef('v2'), 'v2');
        assert.equal(normalizeMobileLayoutModeRef('legacy'), 'legacy');
    });

    it('trims and lowercases supported layout modes', () => {
        assert.equal(normalizeMobileLayoutModeRef(' V2 '), 'v2');
        assert.equal(normalizeMobileLayoutModeRef('\tLEGACY\n'), 'legacy');
    });

    it('returns null for unsupported and empty values', () => {
        for (const value of ['modern', 'v3', '', '   ', null, undefined, 0, false]) {
            assert.equal(normalizeMobileLayoutModeRef(value), null);
        }
    });
});
