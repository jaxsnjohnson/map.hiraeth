const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionSource(name) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < appSource.length; i += 1) {
        const char = appSource[i];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }
    if (end === -1) {
        throw new Error(`Could not parse function ${name}`);
    }
    return appSource.slice(start, end);
}

const clampZoomLevelSource = extractFunctionSource('clampZoomLevel');
const stepSmoothWheelZoomSource = extractFunctionSource('stepSmoothWheelZoom');

function runTest(testFn) {
    const sandbox = {
        console: { log: () => {}, warn: () => {}, error: () => {} },
        Math: Math,
        SMOOTH_WHEEL_SETTLE_DELTA: 0.002,
        SMOOTH_WHEEL_EASE: 0.32,
        smoothWheelFrameId: 123,
        map: null,
        smoothWheelTargetZoom: null,
        smoothWheelAnchorPoint: null,
        scheduleSmoothWheelFrame: () => { sandbox.smoothWheelFrameId = 456; }
    };

    vm.createContext(sandbox);
    vm.runInContext(`
        ${clampZoomLevelSource}
        ${stepSmoothWheelZoomSource}
    `, sandbox);

    testFn(sandbox);
}

describe('stepSmoothWheelZoom', () => {
    it('returns early if map is null', () => {
        runTest((sandbox) => {
            sandbox.map = null;
            sandbox.smoothWheelTargetZoom = 5;
            sandbox.smoothWheelAnchorPoint = { x: 10, y: 10 };
            sandbox.smoothWheelFrameId = 123;

            sandbox.stepSmoothWheelZoom();

            assert.equal(sandbox.smoothWheelFrameId, null);
        });
    });

    it('returns early if smoothWheelTargetZoom is null', () => {
        runTest((sandbox) => {
            sandbox.map = { getZoom: () => 1 };
            sandbox.smoothWheelTargetZoom = null;
            sandbox.smoothWheelAnchorPoint = { x: 10, y: 10 };
            sandbox.smoothWheelFrameId = 123;

            sandbox.stepSmoothWheelZoom();

            assert.equal(sandbox.smoothWheelFrameId, null);
        });
    });

    it('returns early if smoothWheelAnchorPoint is null', () => {
        runTest((sandbox) => {
            sandbox.map = { getZoom: () => 1 };
            sandbox.smoothWheelTargetZoom = 5;
            sandbox.smoothWheelAnchorPoint = null;
            sandbox.smoothWheelFrameId = 123;

            sandbox.stepSmoothWheelZoom();

            assert.equal(sandbox.smoothWheelFrameId, null);
        });
    });

    it('sets map zoom to target when remaining zoom is within settle delta', () => {
        let setZoomCalled = false;
        let setZoomArgs = null;

        runTest((sandbox) => {
            sandbox.mapOptions = { minZoom: 0, maxZoom: 10 };
            sandbox.map = {
                getZoom: () => 4.999,
                getMinZoom: () => 0,
                getMaxZoom: () => 10,
                setZoomAround: (anchor, z, opts) => {
                    setZoomCalled = true;
                    setZoomArgs = { anchor, z, opts };
                }
            };
            sandbox.smoothWheelTargetZoom = 5;
            sandbox.smoothWheelAnchorPoint = { x: 10, y: 10 };

            sandbox.stepSmoothWheelZoom();

            assert.equal(setZoomCalled, true);
            assert.deepEqual(setZoomArgs.anchor, { x: 10, y: 10 });
            assert.equal(setZoomArgs.z, 5); // Target zoom directly
            assert.equal(setZoomArgs.opts.animate, false);
            // Next frame should not be scheduled
            assert.equal(sandbox.smoothWheelFrameId, null);
        });
    });

    it('sets intermediate zoom and schedules next frame when remaining zoom is above settle delta', () => {
        let setZoomCalled = false;
        let setZoomArgs = null;

        runTest((sandbox) => {
            sandbox.mapOptions = { minZoom: 0, maxZoom: 10 };
            sandbox.map = {
                currentZoom: 3,
                getZoom: function() { return this.currentZoom; },
                getMinZoom: () => 0,
                getMaxZoom: () => 10,
                setZoomAround: (anchor, z, opts) => {
                    setZoomCalled = true;
                    setZoomArgs = { anchor, z, opts };
                }
            };
            sandbox.smoothWheelTargetZoom = 5; // Target
            sandbox.smoothWheelAnchorPoint = { x: 10, y: 10 };

            sandbox.stepSmoothWheelZoom();

            assert.equal(setZoomCalled, true);

            // expected: currentZoom (3) + (remaining (2) * SMOOTH_WHEEL_EASE (0.32)) = 3.64
            assert.equal(setZoomArgs.z, 3.64);

            // Next frame should be scheduled because remaining (5 - 3.64 = 1.36) > SMOOTH_WHEEL_SETTLE_DELTA (0.002)
            assert.equal(sandbox.smoothWheelFrameId, 456);
        });
    });
});
