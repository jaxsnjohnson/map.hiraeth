const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const sanitizeStart = appSource.indexOf('function sanitizeTextForHtml(value) {');
const escapeStart = appSource.indexOf('function escapeForSingleQuotedAttribute(value) {');
const tooltipStart = appSource.indexOf('function createPoiTooltipContent(data) {');
const tooltipOptionsStart = appSource.indexOf('function getPoiTooltipOptions() {');

if (
    sanitizeStart === -1 ||
    escapeStart === -1 ||
    tooltipStart === -1 ||
    tooltipOptionsStart === -1 ||
    escapeStart <= sanitizeStart ||
    tooltipOptionsStart <= tooltipStart
) {
    throw new Error('Could not locate POI tooltip helpers in js/app.js');
}

const sanitizeSource = appSource.slice(sanitizeStart, escapeStart);
const tooltipSource = appSource.slice(tooltipStart, tooltipOptionsStart);
const tooltipOptionsSource = appSource.slice(tooltipOptionsStart, appSource.indexOf('function clearTransientMapSearchParams('));

// eslint-disable-next-line no-eval
eval(sanitizeSource);
// eslint-disable-next-line no-eval
eval(tooltipSource);
const L = {
    point(x, y) {
        return { x, y };
    }
};
// eslint-disable-next-line no-eval
eval(tooltipOptionsSource);

assert.equal(
    createPoiTooltipContent({ name: 'Old Dock', type: 'Harbor' }),
    'Old Dock <span class="poi-hover-tooltip-separator">•</span> Harbor'
);

assert.equal(
    createPoiTooltipContent({ name: 'Old <Dock>', type: 'Harbor & Trade' }),
    'Old &lt;Dock&gt; <span class="poi-hover-tooltip-separator">•</span> Harbor &amp; Trade'
);

assert.equal(
    createPoiTooltipContent({ name: '', type: '' }),
    'Unnamed Location'
);

assert.ok(
    !createPoiTooltipContent({
        name: '<img src=x onerror=alert(1)>',
        type: '<script>alert(1)</script>'
    }).includes('<script>')
);

assert.deepEqual(
    getPoiTooltipOptions(),
    {
        direction: 'top',
        offset: { x: 0, y: -32 },
        opacity: 0.96,
        className: 'poi-hover-tooltip'
    }
);

console.log('createPoiTooltipContent regression checks passed');
