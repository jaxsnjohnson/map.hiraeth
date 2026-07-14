const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

describe('endSmoothWheelZoom', () => {
    // Extract the exact function string from app.js to test it in isolation
    const start = appSource.indexOf('function endSmoothWheelZoom() {');
    let nestedCount = 0;
    let end = -1;

    for (let i = start; i < appSource.length; i++) {
        if (appSource[i] === '{') nestedCount++;
        if (appSource[i] === '}') {
            nestedCount--;
            if (nestedCount === 0) {
                end = i + 1;
                break;
            }
        }
    }

    const fnStr = appSource.substring(start, end);

    function createSandbox(initialState) {
        let cancelledFrameId = null;
        let cancelledTimeoutId = null;

        let state = {
            smoothWheelFrameId: null,
            smoothWheelIdleTimeoutId: null,
            smoothWheelTargetZoom: null,
            smoothWheelAnchorPoint: null,
            map: null,
            cancelAnimationFrame: (id) => { cancelledFrameId = id; },
            clearTimeout: (id) => { cancelledTimeoutId = id; },
            clampZoomLevel: (z) => z,
            endMapInteraction: () => { state.endMapInteractionCalled = true; },
            setZoomAroundArgs: null,
            endMapInteractionCalled: false,
            ...initialState
        };

        const wrapper = `
            return function(state) {
                let smoothWheelFrameId = state.smoothWheelFrameId;
                let smoothWheelIdleTimeoutId = state.smoothWheelIdleTimeoutId;
                let smoothWheelTargetZoom = state.smoothWheelTargetZoom;
                let smoothWheelAnchorPoint = state.smoothWheelAnchorPoint;
                let map = state.map;

                // Add support for testing optional cancelAnimationFrame availability
                const cancelAnimationFrame = state.cancelAnimationFrame;
                const clearTimeout = state.clearTimeout;
                const clampZoomLevel = state.clampZoomLevel;
                const endMapInteraction = state.endMapInteraction;

                ${fnStr}

                endSmoothWheelZoom();

                state.smoothWheelFrameId = smoothWheelFrameId;
                state.smoothWheelIdleTimeoutId = smoothWheelIdleTimeoutId;
                state.smoothWheelTargetZoom = smoothWheelTargetZoom;
                state.smoothWheelAnchorPoint = smoothWheelAnchorPoint;
            };
        `;

        const testFn = new Function(wrapper)();

        return {
            run: () => testFn(state),
            state: state,
            getCancelledFrameId: () => cancelledFrameId,
            getCancelledTimeoutId: () => cancelledTimeoutId
        };
    }

    it('clears active animation frame and timeout, updates zoom, and resets state', () => {
        const sandbox = createSandbox({
            smoothWheelFrameId: 123,
            smoothWheelIdleTimeoutId: 456,
            smoothWheelTargetZoom: 5,
            smoothWheelAnchorPoint: { x: 10, y: 10 },
            map: {
                setZoomAround: function(anchor, zoom, options) {
                    this.setZoomAroundArgs = { anchor, zoom, options };
                }
            }
        });

        // Fix map reference back to state
        sandbox.state.map.setZoomAround = (anchor, zoom, options) => {
            sandbox.state.setZoomAroundArgs = { anchor, zoom, options };
        };

        sandbox.run();

        const state = sandbox.state;
        assert.equal(state.smoothWheelFrameId, null);
        assert.equal(state.smoothWheelIdleTimeoutId, null);
        assert.equal(state.smoothWheelTargetZoom, null);
        assert.equal(state.smoothWheelAnchorPoint, null);

        assert.equal(sandbox.getCancelledFrameId(), 123);

        assert.ok(state.setZoomAroundArgs);
        assert.equal(state.setZoomAroundArgs.anchor.x, 10);
        assert.equal(state.setZoomAroundArgs.zoom, 5);
        assert.equal(state.setZoomAroundArgs.options.animate, false);

        assert.equal(state.endMapInteractionCalled, true);
    });

    it('uses clearTimeout if cancelAnimationFrame is undefined (fallback)', () => {
        const sandbox = createSandbox({
            smoothWheelFrameId: 123,
            cancelAnimationFrame: undefined // Force undefined
        });

        sandbox.run();

        assert.equal(sandbox.state.smoothWheelFrameId, null);
        assert.equal(sandbox.getCancelledTimeoutId(), 123);
        assert.equal(sandbox.getCancelledFrameId(), null);
    });

    it('skips setZoomAround if map is null', () => {
        const sandbox = createSandbox({
            map: null,
            smoothWheelTargetZoom: 5,
            smoothWheelAnchorPoint: { x: 10, y: 10 }
        });

        sandbox.run();

        assert.equal(sandbox.state.setZoomAroundArgs, null);
        assert.equal(sandbox.state.endMapInteractionCalled, true);
    });

    it('skips setZoomAround if smoothWheelTargetZoom is null', () => {
        const sandbox = createSandbox({
            map: {
                setZoomAround: () => {
                    assert.fail('should not call setZoomAround');
                }
            },
            smoothWheelTargetZoom: null,
            smoothWheelAnchorPoint: { x: 10, y: 10 }
        });

        sandbox.run();

        assert.equal(sandbox.state.setZoomAroundArgs, null);
        assert.equal(sandbox.state.endMapInteractionCalled, true);
    });

    it('skips setZoomAround if smoothWheelAnchorPoint is null', () => {
        const sandbox = createSandbox({
            map: {
                setZoomAround: () => {
                    assert.fail('should not call setZoomAround');
                }
            },
            smoothWheelTargetZoom: 5,
            smoothWheelAnchorPoint: null
        });

        sandbox.run();

        assert.equal(sandbox.state.setZoomAroundArgs, null);
        assert.equal(sandbox.state.endMapInteractionCalled, true);
    });

    it('does not throw and correctly resets variables if smoothWheelFrameId is null', () => {
        const sandbox = createSandbox({
            smoothWheelFrameId: null,
            map: null
        });

        assert.doesNotThrow(() => {
            sandbox.run();
        });

        assert.equal(sandbox.getCancelledFrameId(), null);
        assert.equal(sandbox.getCancelledTimeoutId(), null);
        assert.equal(sandbox.state.endMapInteractionCalled, true);
    });
});
