const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const SharedUtils = require('../js/shared-utils.js');

function createMock(implementation = () => undefined) {
    const fn = (...args) => {
        fn.calls.push(args);
        return implementation(...args);
    };
    fn.calls = [];
    fn.setImplementation = (nextImplementation) => {
        implementation = nextImplementation;
    };
    return fn;
}

describe('fetchJsonAsset', () => {
    let originalFetch;
    let originalWindow;

    beforeEach(() => {
        originalFetch = global.fetch;
        originalWindow = global.window;

        global.window = { APP_ASSET_VERSION: '1.0' };

        global.fetch = createMock();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        global.window = originalWindow;
    });

    it('fetches json asset with correct version parameter', async () => {
        const jsonMock = createMock(() => Promise.resolve({ data: 'test' }));
        const mockResponse = { ok: true, json: jsonMock };
        global.fetch.setImplementation(() => Promise.resolve(mockResponse));

        const result = await SharedUtils.fetchJsonAsset('test.json');

        assert.deepEqual(global.fetch.calls[0], ['test.json?v=1.0']);
        assert.equal(jsonMock.calls.length, 1);
        assert.deepEqual(result, { data: 'test' });
    });

    it('throws error when response is not ok', async () => {
        const mockResponse = { ok: false, status: 404, statusText: 'Not Found' };
        global.fetch.setImplementation(() => Promise.resolve(mockResponse));

        await assert.rejects(
            () => SharedUtils.fetchJsonAsset('test.json'),
            /Failed to load test\.json: 404 Not Found/
        );
    });
});
