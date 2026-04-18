const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const styleSource = fs.readFileSync('css/style.css', 'utf8');

assert.match(indexSource, /id="mobile-info-help-btn"/);
assert.match(indexSource, /id="mobile-dock"/);
assert.match(indexSource, /id="mobile-sheet-launcher-btn"/);
assert.match(indexSource, /id="mobile-search-launcher-btn"/);
assert.match(indexSource, /id="mobile-search-panel"/);
assert.match(indexSource, /id="mobile-search-panel-close-btn"/);
assert.match(indexSource, /id="mobile-search-panel-title">Atlas</);
assert.match(indexSource, /id="mobile-search-panel-search-slot"/);
assert.match(indexSource, /id="mobile-search-results-card"/);
assert.match(indexSource, /id="mobile-search-panel-results-slot"/);
assert.match(indexSource, /id="mobile-map-list-section"/);
assert.match(indexSource, /id="mobile-search-panel-map-list-slot"/);
assert.ok(indexSource.indexOf('id="mobile-dock"') < indexSource.indexOf('id="mobile-search-panel"'));
assert.ok(indexSource.indexOf('id="mobile-search-panel"') < indexSource.indexOf('id="search-control-container"'));

assert.doesNotMatch(indexSource, /id="mobile-search-card"/);
assert.doesNotMatch(indexSource, /id="mobile-search-actions-card"/);
assert.doesNotMatch(indexSource, /id="mobile-current-map-summary-name"/);
assert.doesNotMatch(indexSource, /id="mobile-current-map-summary-blurb"/);
assert.doesNotMatch(indexSource, /id="mobile-map-list-toggle-btn"/);
assert.doesNotMatch(indexSource, /id="mobile-map-list-preview"/);
assert.doesNotMatch(indexSource, /id="mobile-map-list-preview-name"/);
assert.doesNotMatch(indexSource, /id="mobile-map-list-preview-meta"/);
assert.doesNotMatch(indexSource, /id="mobile-utility-actions"/);
assert.doesNotMatch(indexSource, /id="mobile-help-btn"/);

assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-info-help-btn \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-launcher-btn \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #map-blurb \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-panel \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-panel-search-slot,\s*[\s\S]*#mobile-map-list-section \{/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-panel-search-slot\[hidden\],/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout \.mobile-map-blurb-card \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-panel-map-list-slot \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout \.container\.mobile-search-panel-open #mobile-search-panel \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout \.leaflet-control-minimap \{\s*display: none !important;\s*\}/m);

console.log('mobile shell markup checks passed');
