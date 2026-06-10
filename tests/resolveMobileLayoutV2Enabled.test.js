const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const appSource = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');

const startIndex = appSource.indexOf('function resolveMobileLayoutV2Enabled() {');
const nextFunctionIndex = appSource.indexOf('function resolveControlVisibilityState(');
const functionString = appSource.substring(startIndex, nextFunctionIndex);

let resolveMobileLayoutV2Enabled;
eval(`resolveMobileLayoutV2Enabled = ${functionString}`);

function createMock() {
    const fn = (...args) => {
        fn.calls.push(args);
        return fn.returnValue;
    };
    fn.calls = [];
    fn.mockReturnValue = (value) => {
        fn.returnValue = value;
    };
    return fn;
}

describe('resolveMobileLayoutV2Enabled', () => {
    beforeEach(() => {
        global.getMobileLayoutModeFromUrl = createMock();
        global.safeSetStorage = createMock();
        global.safeGetStorage = createMock();
        global.normalizeMobileLayoutMode = createMock();

        global.UX_STORAGE_KEYS = { mobileLayoutMode: 'mobileLayoutMode' };
        global.MOBILE_LAYOUT_MODE_V2 = 'v2';
    });

    afterEach(() => {
        delete global.getMobileLayoutModeFromUrl;
        delete global.safeSetStorage;
        delete global.safeGetStorage;
        delete global.normalizeMobileLayoutMode;

        delete global.UX_STORAGE_KEYS;
        delete global.MOBILE_LAYOUT_MODE_V2;
    });

    it('should return true and set storage when URL mode is v2', () => {
        global.getMobileLayoutModeFromUrl.mockReturnValue('v2');

        const result = resolveMobileLayoutV2Enabled();

        assert.equal(result, true);
        assert.deepEqual(global.safeSetStorage.calls, [['mobileLayoutMode', 'v2']]);
        assert.equal(global.safeGetStorage.calls.length, 0);
        assert.equal(global.normalizeMobileLayoutMode.calls.length, 0);
    });

    it('should return false and set storage when URL mode is non-v2', () => {
        global.getMobileLayoutModeFromUrl.mockReturnValue('legacy');

        const result = resolveMobileLayoutV2Enabled();

        assert.equal(result, false);
        assert.deepEqual(global.safeSetStorage.calls, [['mobileLayoutMode', 'legacy']]);
        assert.equal(global.safeGetStorage.calls.length, 0);
        assert.equal(global.normalizeMobileLayoutMode.calls.length, 0);
    });

    it('should return true when no URL mode but storage mode is v2', () => {
        global.getMobileLayoutModeFromUrl.mockReturnValue(null);
        global.safeGetStorage.mockReturnValue('v2_raw');
        global.normalizeMobileLayoutMode.mockReturnValue('v2');

        const result = resolveMobileLayoutV2Enabled();

        assert.equal(result, true);
        assert.deepEqual(global.safeGetStorage.calls, [['mobileLayoutMode']]);
        assert.deepEqual(global.normalizeMobileLayoutMode.calls, [['v2_raw']]);
        assert.equal(global.safeSetStorage.calls.length, 0);
    });

    it('should fall back to setting v2 in storage and returning true when both URL and storage are empty', () => {
        global.getMobileLayoutModeFromUrl.mockReturnValue(null);
        global.safeGetStorage.mockReturnValue(null);
        global.normalizeMobileLayoutMode.mockReturnValue(null);

        const result = resolveMobileLayoutV2Enabled();

        assert.equal(result, true);
        assert.deepEqual(global.safeGetStorage.calls, [['mobileLayoutMode']]);
        assert.deepEqual(global.normalizeMobileLayoutMode.calls, [[null]]);
        assert.deepEqual(global.safeSetStorage.calls, [['mobileLayoutMode', 'v2']]);
    });
});
