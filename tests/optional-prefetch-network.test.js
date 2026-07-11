const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const start = appSource.indexOf('function shouldAvoidOptionalPrefetch(');
const end = appSource.indexOf('async function prefetchJsonAsset(', start);

assert.notEqual(start, -1);
assert.notEqual(end, -1);
// eslint-disable-next-line no-eval
eval(appSource.slice(start, end));

assert.equal(shouldAvoidOptionalPrefetch(null), false);
assert.equal(shouldAvoidOptionalPrefetch({ saveData: true, effectiveType: '4g' }), true);
assert.equal(shouldAvoidOptionalPrefetch({ saveData: false, effectiveType: 'slow-2g' }), true);
assert.equal(shouldAvoidOptionalPrefetch({ saveData: false, effectiveType: '2g' }), true);
assert.equal(shouldAvoidOptionalPrefetch({ saveData: false, effectiveType: '3g' }), false);
assert.equal(shouldAvoidOptionalPrefetch({ saveData: false, effectiveType: '4g' }), false);

console.log('optional prefetch network checks passed');
