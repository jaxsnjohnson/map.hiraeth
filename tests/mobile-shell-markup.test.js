const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const styleSource = fs.readFileSync('css/style.css', 'utf8');

assert.match(indexSource, /id="mobile-search-trigger"/);
assert.match(indexSource, /id="mobile-search-shell"/);
assert.match(indexSource, /id="mobile-search-close-btn"/);
assert.match(indexSource, /id="mobile-sidebar-close-btn"/);
assert.match(indexSource, /id="mobile-sidebar-meta"/);
assert.match(indexSource, /id="mobile-sidebar-actions"/);
assert.match(indexSource, /id="mobile-sidebar-links"/);
assert.match(indexSource, /id="mobile-map-blurb-panel"/);
assert.match(indexSource, /id="mobile-about-link"/);
assert.ok(indexSource.indexOf('id="mobile-sidebar-actions"') < indexSource.indexOf('id="map-list"'));
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-trigger \{[\s\S]*bottom:/);

console.log('mobile shell markup checks passed');
