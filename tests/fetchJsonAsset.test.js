import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

const SharedUtils = require('../js/shared-utils.js');

describe('fetchJsonAsset', () => {
    let originalFetch;
    let originalWindow;

    beforeEach(() => {
        originalFetch = global.fetch;
        originalWindow = global.window;

        global.window = { APP_ASSET_VERSION: '1.0' };

        global.fetch = mock();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        global.window = originalWindow;
    });

    it('fetches json asset with correct version parameter', async () => {
        const mockResponse = { ok: true, json: mock().mockResolvedValue({ data: 'test' }) };
        global.fetch.mockResolvedValue(mockResponse);

        const result = await SharedUtils.fetchJsonAsset('test.json');

        expect(global.fetch).toHaveBeenCalledWith('test.json?v=1.0');
        expect(mockResponse.json).toHaveBeenCalled();
        expect(result).toEqual({ data: 'test' });
    });

    it('throws error when response is not ok', async () => {
        const mockResponse = { ok: false, status: 404, statusText: 'Not Found' };
        global.fetch.mockResolvedValue(mockResponse);

        await expect(SharedUtils.fetchJsonAsset('test.json')).rejects.toThrow('Failed to load test.json: 404 Not Found');
    });
});
