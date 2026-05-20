(() => {
    const assert = require('node:assert/strict');
    const fs = require('node:fs');

    const appSource = fs.readFileSync('js/app.js', 'utf8');

    const start = appSource.indexOf('function getPoiTooltipOptions() {');
    const end = appSource.indexOf('function attachPoiTooltipBehavior(marker) {');

    if (start === -1 || end === -1 || start >= end) {
        throw new Error('Could not locate getPoiTooltipOptions in js/app.js');
    }

    const getPoiTooltipOptionsSource = appSource.slice(start, end);

    // Setup mock environment
    global.L = {
        point: (x, y) => ({ x, y, _isPoint: true })
    };

    // Evaluate the function source code
    // eslint-disable-next-line no-eval
    eval(getPoiTooltipOptionsSource);

    // Execute function
    const options = getPoiTooltipOptions();

    // Verify correct returned options
    assert.equal(options.direction, 'top', 'Should have direction set to "top"');
    assert.equal(options.opacity, 0.96, 'Should have opacity set to 0.96');
    assert.equal(options.className, 'poi-hover-tooltip', 'Should have className set to "poi-hover-tooltip"');

    // Verify L.point usage for offset
    assert.equal(options.offset.x, 0, 'Should have offset x at 0');
    assert.equal(options.offset.y, -32, 'Should have offset y at -32');
    assert.equal(options.offset._isPoint, true, 'Should use L.point to generate offset');

    // Cleanup mock environment
    delete global.L;

    console.log('getPoiTooltipOptions tests passed');
})();