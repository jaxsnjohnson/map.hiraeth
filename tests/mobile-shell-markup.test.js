const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const styleSource = fs.readFileSync('css/style.css', 'utf8');

assert.match(indexSource, /id="mobile-sheet"/);
assert.match(indexSource, /id="mobile-sheet-close-btn"/);
assert.match(indexSource, /id="mobile-sheet-mode-explore-btn"/);
assert.match(indexSource, /id="mobile-sheet-mode-map-btn"/);
assert.match(indexSource, /id="mobile-sheet-search-slot"/);
assert.match(indexSource, /id="mobile-map-list-slot"/);
assert.match(indexSource, /id="mobile-sheet-actions"/);
assert.match(indexSource, /id="mobile-sheet-links"/);
assert.match(indexSource, /id="mobile-map-blurb-panel"/);
assert.match(indexSource, /id="mobile-about-link"/);
assert.ok(indexSource.indexOf('id="mobile-sheet-actions"') < indexSource.indexOf('id="search-control-container"'));
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-sheet \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-sheet #search-control-container \{/);
assert.doesNotMatch(indexSource, /id="mobile-search-trigger"/);
assert.doesNotMatch(indexSource, /id="mobile-search-shell"/);

console.log('mobile shell markup checks passed');
