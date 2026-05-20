import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';

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
        expect(() => refreshLucideIcons()).not.toThrow();
    });

    it('should not throw an error if window.lucide is defined but createIcons is not a function', () => {
        global.window.lucide = {};
        expect(() => refreshLucideIcons()).not.toThrow();

        global.window.lucide.createIcons = 'not a function';
        expect(() => refreshLucideIcons()).not.toThrow();
    });

    it('should call window.lucide.createIcons if it is a function', () => {
        const createIconsMock = vi.fn();
        global.window.lucide = {
            createIcons: createIconsMock
        };

        refreshLucideIcons();

        expect(createIconsMock).toHaveBeenCalled();
    });
});
