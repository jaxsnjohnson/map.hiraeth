import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
const fs = require('fs');

const appSource = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');

const startIndex = appSource.indexOf('function resolveMobileLayoutV2Enabled() {');
const nextFunctionIndex = appSource.indexOf('function resolveControlVisibilityState(');
const functionString = appSource.substring(startIndex, nextFunctionIndex);

let resolveMobileLayoutV2Enabled;
eval(`resolveMobileLayoutV2Enabled = ${functionString}`);

describe('resolveMobileLayoutV2Enabled', () => {
    beforeEach(() => {
        global.getMobileLayoutModeFromUrl = vi.fn();
        global.safeSetStorage = vi.fn();
        global.safeGetStorage = vi.fn();
        global.normalizeMobileLayoutMode = vi.fn();

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

        expect(result).toBe(true);
        expect(global.safeSetStorage).toHaveBeenCalledWith('mobileLayoutMode', 'v2');
        expect(global.safeGetStorage).not.toHaveBeenCalled();
        expect(global.normalizeMobileLayoutMode).not.toHaveBeenCalled();
    });

    it('should return false and set storage when URL mode is non-v2', () => {
        global.getMobileLayoutModeFromUrl.mockReturnValue('legacy');

        const result = resolveMobileLayoutV2Enabled();

        expect(result).toBe(false);
        expect(global.safeSetStorage).toHaveBeenCalledWith('mobileLayoutMode', 'legacy');
        expect(global.safeGetStorage).not.toHaveBeenCalled();
        expect(global.normalizeMobileLayoutMode).not.toHaveBeenCalled();
    });

    it('should return true when no URL mode but storage mode is v2', () => {
        global.getMobileLayoutModeFromUrl.mockReturnValue(null);
        global.safeGetStorage.mockReturnValue('v2_raw');
        global.normalizeMobileLayoutMode.mockReturnValue('v2');

        const result = resolveMobileLayoutV2Enabled();

        expect(result).toBe(true);
        expect(global.safeGetStorage).toHaveBeenCalledWith('mobileLayoutMode');
        expect(global.normalizeMobileLayoutMode).toHaveBeenCalledWith('v2_raw');
        // It shouldn't set storage if read from storage
        expect(global.safeSetStorage).not.toHaveBeenCalled();
    });

    it('should fall back to setting v2 in storage and returning true when both URL and storage are empty', () => {
        global.getMobileLayoutModeFromUrl.mockReturnValue(null);
        global.safeGetStorage.mockReturnValue(null);
        global.normalizeMobileLayoutMode.mockReturnValue(null);

        const result = resolveMobileLayoutV2Enabled();

        expect(result).toBe(true);
        expect(global.safeGetStorage).toHaveBeenCalledWith('mobileLayoutMode');
        expect(global.normalizeMobileLayoutMode).toHaveBeenCalledWith(null);
        expect(global.safeSetStorage).toHaveBeenCalledWith('mobileLayoutMode', 'v2');
    });
});
