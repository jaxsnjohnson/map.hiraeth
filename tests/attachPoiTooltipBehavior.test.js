const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(function() {
    const appSource = fs.readFileSync('js/app.js', 'utf8');
    const helperStart = appSource.indexOf('function attachPoiTooltipBehavior(marker) {');
    const nextHelperStart = appSource.indexOf('function clearTransientMapSearchParams(');

    if (helperStart === -1 || nextHelperStart === -1 || nextHelperStart <= helperStart) {
        throw new Error('Could not locate attachPoiTooltipBehavior in js/app.js');
    }

    const helperSource = appSource.slice(helperStart, nextHelperStart);

    // eslint-disable-next-line no-eval
    eval(helperSource);

    describe('attachPoiTooltipBehavior', () => {
        it('returns marker if marker is null or lacks "on" function', () => {
            assert.equal(attachPoiTooltipBehavior(null), null);
            assert.deepEqual(attachPoiTooltipBehavior({}), {});
            assert.deepEqual(attachPoiTooltipBehavior({ on: 'not a function' }), { on: 'not a function' });
        });

        it('initializes poiPopupActive to false and sets up event listeners', () => {
            const events = {};
            const marker = {
                on: (event, handler) => {
                    events[event] = handler;
                }
            };

            const result = attachPoiTooltipBehavior(marker);

            assert.equal(result, marker);
            assert.equal(result.poiPopupActive, false);
            assert.ok(typeof events.popupopen === 'function');
            assert.ok(typeof events.popupclose === 'function');
            assert.ok(typeof events.tooltipopen === 'function');
        });

        it('sets poiPopupActive to true and closes tooltip on popupopen', () => {
            const events = {};
            let tooltipClosed = false;
            const marker = {
                on: (event, handler) => {
                    events[event] = handler;
                },
                closeTooltip: () => {
                    tooltipClosed = true;
                }
            };

            attachPoiTooltipBehavior(marker);

            // Trigger popupopen
            events.popupopen();

            assert.equal(marker.poiPopupActive, true);
            assert.equal(tooltipClosed, true);
        });

        it('sets poiPopupActive to true on popupopen without closing tooltip if closeTooltip is not a function', () => {
            const events = {};
            const marker = {
                on: (event, handler) => {
                    events[event] = handler;
                }
            };

            attachPoiTooltipBehavior(marker);

            // Trigger popupopen
            events.popupopen();

            assert.equal(marker.poiPopupActive, true);
        });


        it('sets poiPopupActive to false on popupclose', () => {
             const events = {};
             const marker = {
                 on: (event, handler) => {
                     events[event] = handler;
                 }
             };

             attachPoiTooltipBehavior(marker);

             // Setup initial state as true
             marker.poiPopupActive = true;

             // Trigger popupclose
             events.popupclose();

             assert.equal(marker.poiPopupActive, false);
        });

        it('closes tooltip on tooltipopen if poiPopupActive is true', () => {
            const events = {};
            let tooltipClosed = false;
            const marker = {
                on: (event, handler) => {
                    events[event] = handler;
                },
                closeTooltip: () => {
                    tooltipClosed = true;
                }
            };

            attachPoiTooltipBehavior(marker);

            // Setup initial state as true
            marker.poiPopupActive = true;

            // Trigger tooltipopen
            events.tooltipopen();

            assert.equal(tooltipClosed, true);
        });

        it('does not close tooltip on tooltipopen if poiPopupActive is false', () => {
            const events = {};
            let tooltipClosed = false;
            const marker = {
                on: (event, handler) => {
                    events[event] = handler;
                },
                closeTooltip: () => {
                    tooltipClosed = true;
                }
            };

            attachPoiTooltipBehavior(marker);

            // Setup initial state as false
            marker.poiPopupActive = false;

            // Trigger tooltipopen
            events.tooltipopen();

            assert.equal(tooltipClosed, false);
        });

    });

})();
