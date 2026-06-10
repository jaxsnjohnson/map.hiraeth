const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const normalizeStart = appSource.indexOf('function normalizeMobileLayoutMode(');
const normalizeEnd = appSource.indexOf('function getMobileLayoutModeFromUrl()', normalizeStart);
const normalizeSource = appSource.slice(normalizeStart, normalizeEnd);

const getUrlParamsStart = appSource.indexOf('function getUrlParameters() {');
const getUrlParamsEnd = appSource.indexOf('function isEmbedModeFromUrl()', getUrlParamsStart);
const getUrlParamsSource = appSource.slice(getUrlParamsStart, getUrlParamsEnd);

const getModeStart = appSource.indexOf('function getMobileLayoutModeFromUrl() {');
const getModeEnd = appSource.indexOf('function resolveMobileLayoutV2Enabled()', getModeStart);
const getModeSource = appSource.slice(getModeStart, getModeEnd);

let getMobileLayoutModeFromUrlRef;

(() => {
    global.MOBILE_LAYOUT_MODE_V2 = 'v2';
    global.MOBILE_LAYOUT_MODE_LEGACY = 'legacy';
    global.MOBILE_LAYOUT_QUERY_PARAM = 'mobileLayout';

    eval(`
        ${normalizeSource}
        ${getUrlParamsSource}
        ${getModeSource}
        getMobileLayoutModeFromUrlRef = getMobileLayoutModeFromUrl;
    `);
})();

describe('getMobileLayoutModeFromUrl', () => {
    const originalWindow = global.window;

    afterEach(() => {
        global.window = originalWindow;
    });

    it('returns "v2" when mobileLayout=v2', () => {
        global.window = { location: { search: '?mobileLayout=v2' } };
        assert.equal(getMobileLayoutModeFromUrlRef(), 'v2');
    });

    it('returns "legacy" when mobileLayout=legacy', () => {
        global.window = { location: { search: '?mobileLayout=legacy' } };
        assert.equal(getMobileLayoutModeFromUrlRef(), 'legacy');
    });

    it('returns null when mobileLayout is invalid', () => {
        global.window = { location: { search: '?mobileLayout=invalid' } };
        assert.equal(getMobileLayoutModeFromUrlRef(), null);
    });

    it('returns null when mobileLayout is missing', () => {
        global.window = { location: { search: '?otherParam=123' } };
        assert.equal(getMobileLayoutModeFromUrlRef(), null);
    });

    it('returns null when search is empty', () => {
        global.window = { location: { search: '' } };
        assert.equal(getMobileLayoutModeFromUrlRef(), null);
    });

    it('returns "v2" ignoring case and whitespace', () => {
        global.window = { location: { search: '?mobileLayout=%20V2%20' } };
        assert.equal(getMobileLayoutModeFromUrlRef(), 'v2');
    });
});
