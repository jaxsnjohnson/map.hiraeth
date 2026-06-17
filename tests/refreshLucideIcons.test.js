const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('fs');
const appSource = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');

// Extract the refreshLucideIcons function logic
const startIndex = appSource.indexOf('function refreshLucideIcons() {');
const nextFunctionIndex = appSource.indexOf('// --- Measurement Tool State ---', startIndex);
const functionString = appSource.substring(startIndex, nextFunctionIndex);

let refreshLucideIcons;
eval(`refreshLucideIcons = ${functionString}`);

describe('refreshLucideIcons', () => {
    beforeEach(() => {
        global.window = {};
    });

    afterEach(() => {
        delete global.window;
    });

    it('should not throw an error if window.lucide is undefined', () => {
        assert.doesNotThrow(() => refreshLucideIcons());
    });

    it('should not throw an error if window.lucide is defined but createIcons is not a function', () => {
        global.window.lucide = {};
        assert.doesNotThrow(() => refreshLucideIcons());

        global.window.lucide.createIcons = 'not a function';
        assert.doesNotThrow(() => refreshLucideIcons());
    });

    it('should call window.lucide.createIcons if it is a function', () => {
        const createIconsMock = () => {
            createIconsMock.calls += 1;
        };
        createIconsMock.calls = 0;
        global.window.lucide = {
            createIcons: createIconsMock
        };

        refreshLucideIcons();

        assert.equal(createIconsMock.calls, 1);
    });
});
