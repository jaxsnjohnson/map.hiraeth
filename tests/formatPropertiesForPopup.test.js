const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function formatPropertiesForPopup(properties, hasFollowingDescription) {');
const fnEnd = appSource.indexOf('function sanitizeTextForHtml(value) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate formatPropertiesForPopup function in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);
// Evaluate the real function source to keep the test tightly coupled to production code.
// eslint-disable-next-line no-eval
eval(fnSource);

assert.doesNotThrow(() => {
    const html = formatPropertiesForPopup({ population: 1200 }, false);
    assert.ok(html.includes('1200'));
});

assert.doesNotThrow(() => {
    const html = formatPropertiesForPopup({ hazard: '<script>alert(1)</script>' }, false);
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

console.log('formatPropertiesForPopup regression checks passed');
