const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const startMarker = 'function prefersReducedMotion() {';
const endMarker = '// --- Measurement Tool State ---';
const start = appSource.indexOf(startMarker);
const end = appSource.indexOf(endMarker, start);

if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate prefersReducedMotion helpers in js/app.js');
}

const snippet = appSource.slice(start, end);
const helpers = {};

// eslint-disable-next-line no-eval
eval(`${snippet}
helpers.prefersReducedMotion = prefersReducedMotion;
helpers.getZoomAnimationOptions = getZoomAnimationOptions;`);

describe('prefersReducedMotion', () => {
    afterEach(() => {
        delete global.window;
    });

    it('returns false outside a browser window', () => {
        delete global.window;

        assert.equal(helpers.prefersReducedMotion(), false);
        assert.deepEqual(helpers.getZoomAnimationOptions(), { animate: true });
    });

    it('returns false when matchMedia is unavailable', () => {
        global.window = {};

        assert.equal(helpers.prefersReducedMotion(), false);
        assert.deepEqual(helpers.getZoomAnimationOptions(), { animate: true });
    });

    it('returns false when the reduced-motion media query does not match', () => {
        const queries = [];
        global.window = {
            matchMedia(query) {
                queries.push(query);
                return { matches: false };
            }
        };

        assert.equal(helpers.prefersReducedMotion(), false);
        assert.deepEqual(helpers.getZoomAnimationOptions(), { animate: true });
        assert.deepEqual(queries, [
            '(prefers-reduced-motion: reduce)',
            '(prefers-reduced-motion: reduce)'
        ]);
    });

    it('returns true and disables zoom animation when reduced motion is requested', () => {
        global.window = {
            matchMedia(query) {
                assert.equal(query, '(prefers-reduced-motion: reduce)');
                return { matches: true };
            }
        };

        assert.equal(helpers.prefersReducedMotion(), true);
        assert.deepEqual(helpers.getZoomAnimationOptions(), { animate: false });
    });
});
