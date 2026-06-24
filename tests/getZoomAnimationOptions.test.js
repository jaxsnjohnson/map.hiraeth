const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const startMarker = 'function prefersReducedMotion() {';
const endMarker = '// --- Measurement Tool State ---';
const start = appSource.indexOf(startMarker);
const end = appSource.indexOf(endMarker, start);

if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate getZoomAnimationOptions in js/app.js');
}

const snippet = appSource.slice(start, end);
let getZoomAnimationOptionsRef;

// eslint-disable-next-line no-eval
eval(`
    ${snippet}
    getZoomAnimationOptionsRef = getZoomAnimationOptions;
`);

function createWindowWithReducedMotion(matches) {
    const matchMediaCalls = [];

    return {
        matchMediaCalls,
        matchMedia(query) {
            matchMediaCalls.push(query);
            return { matches };
        }
    };
}

describe('getZoomAnimationOptions', () => {
    const hadOriginalWindow = Object.prototype.hasOwnProperty.call(global, 'window');
    const originalWindow = global.window;

    afterEach(() => {
        if (hadOriginalWindow) {
            global.window = originalWindow;
        } else {
            delete global.window;
        }
    });

    it('enables animation when window is unavailable', () => {
        delete global.window;

        assert.deepEqual(getZoomAnimationOptionsRef(), { animate: true });
    });

    it('enables animation when matchMedia is unavailable', () => {
        global.window = {};

        assert.deepEqual(getZoomAnimationOptionsRef(), { animate: true });
    });

    it('enables animation when reduced motion is not preferred', () => {
        global.window = createWindowWithReducedMotion(false);

        assert.deepEqual(getZoomAnimationOptionsRef(), { animate: true });
        assert.deepEqual(global.window.matchMediaCalls, ['(prefers-reduced-motion: reduce)']);
    });

    it('disables animation when reduced motion is preferred', () => {
        global.window = createWindowWithReducedMotion(true);

        assert.deepEqual(getZoomAnimationOptionsRef(), { animate: false });
        assert.deepEqual(global.window.matchMediaCalls, ['(prefers-reduced-motion: reduce)']);
    });
});
