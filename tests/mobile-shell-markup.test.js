const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');

assert.match(indexSource, /id="mobile-search-trigger"/);
assert.match(indexSource, /id="mobile-search-shell"/);
assert.match(indexSource, /id="mobile-search-close-btn"/);
assert.match(indexSource, /id="mobile-sidebar-close-btn"/);
assert.match(indexSource, /id="mobile-sidebar-meta"/);
assert.match(indexSource, /id="mobile-sidebar-actions"/);
assert.match(indexSource, /id="mobile-sidebar-links"/);
assert.match(indexSource, /id="mobile-map-blurb-panel"/);
assert.match(indexSource, /id="mobile-about-link"/);

console.log('mobile shell markup checks passed');
