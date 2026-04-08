const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const styleSource = fs.readFileSync('css/style.css', 'utf8');

assert.match(indexSource, /id="mobile-dock"/);
assert.match(indexSource, /id="mobile-sheet-launcher-btn"/);
assert.match(indexSource, /id="mobile-search-panel"/);
assert.match(indexSource, /id="mobile-search-panel-close-btn"/);
assert.match(indexSource, /id="mobile-current-map-summary-card"/);
assert.match(indexSource, /id="mobile-search-card"/);
assert.match(indexSource, /id="mobile-search-actions-card"/);
assert.match(indexSource, /id="mobile-search-results-card"/);
assert.match(indexSource, /id="mobile-maps-current-map-card"/);
assert.match(indexSource, /id="mobile-map-list-section"/);
assert.match(indexSource, /id="mobile-search-panel-map-list-slot"/);
assert.match(indexSource, /id="mobile-utility-actions"/);
assert.match(indexSource, /id="mobile-markers-btn"/);
assert.match(indexSource, /id="mobile-measure-btn"/);
assert.match(indexSource, /id="mobile-share-view-btn"/);
assert.match(indexSource, /id="mobile-coords-btn"/);
assert.match(indexSource, /id="mobile-help-btn"/);
assert.ok(indexSource.indexOf('id="mobile-dock"') < indexSource.indexOf('id="mobile-search-panel"'));
assert.ok(indexSource.indexOf('id="mobile-search-panel"') < indexSource.indexOf('id="search-control-container"'));

assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-dock \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-sheet-launcher-btn \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-panel \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout \.container\.mobile-search-panel-open #mobile-search-panel \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-panel-map-list-slot \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-utility-actions \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-panel #poi-filter-container\.visible \{/);

assert.doesNotMatch(indexSource, /id="mobile-explore-launcher-btn"/);
assert.doesNotMatch(indexSource, /id="mobile-maps-launcher-btn"/);
assert.doesNotMatch(indexSource, /id="mobile-maps-sheet"/);
assert.doesNotMatch(indexSource, /id="mobile-maps-sheet-close-btn"/);
assert.doesNotMatch(indexSource, /id="mobile-maps-sheet-map-list-slot"/);

console.log('mobile shell markup checks passed');
