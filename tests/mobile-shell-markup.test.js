const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const styleSource = fs.readFileSync('css/style.css', 'utf8');

assert.match(indexSource, /id="mobile-sheet"/);
assert.match(indexSource, /id="mobile-maps-launcher-btn"/);
assert.match(indexSource, /id="mobile-sheet-close-btn"/);
assert.match(indexSource, /id="mobile-sheet-mode-explore-btn"/);
assert.match(indexSource, /id="mobile-sheet-mode-map-btn"/);
assert.match(indexSource, /id="mobile-current-map-summary-card"/);
assert.match(indexSource, /id="mobile-current-map-summary-name"/);
assert.match(indexSource, /id="mobile-current-map-summary-blurb"/);
assert.match(indexSource, /id="mobile-search-card"/);
assert.match(indexSource, /id="mobile-sheet-search-slot"/);
assert.match(indexSource, /id="mobile-search-results-card"/);
assert.match(indexSource, /id="mobile-search-results-slot"/);
assert.match(indexSource, /id="mobile-map-list-slot"/);
assert.match(indexSource, /class="mobile-sheet-card"/);
assert.match(indexSource, /class="mobile-sheet-card-title-row"/);
assert.ok(indexSource.indexOf('id="mobile-sheet"') < indexSource.indexOf('id="search-control-container"'));
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-sheet \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout \.mobile-sheet-card \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-results-card \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-sheet #search-control-container \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-maps-launcher-btn \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-sheet #search-scope-atlas-btn \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #toggle-sidebar-btn \{/);
assert.doesNotMatch(indexSource, /id="mobile-search-trigger"/);
assert.doesNotMatch(indexSource, /id="mobile-search-shell"/);
assert.doesNotMatch(indexSource, /id="mobile-dock"/);
assert.doesNotMatch(indexSource, /id="mobile-sheet-actions"/);
assert.doesNotMatch(indexSource, /id="mobile-sheet-links"/);
assert.doesNotMatch(indexSource, /id="mobile-map-blurb-panel"/);
assert.doesNotMatch(indexSource, /id="mobile-about-link"/);

console.log('mobile shell markup checks passed');
