const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const styleSource = fs.readFileSync('css/style.css', 'utf8');

assert.match(indexSource, /id="mobile-info-help-btn"/);
assert.match(indexSource, /id="mobile-dock"/);
assert.match(indexSource, /id="mobile-sheet-launcher-btn"/);
assert.match(indexSource, /id="mobile-search-launcher-btn"/);
assert.match(indexSource, /id="mobile-search-card"/);
assert.match(indexSource, /id="mobile-search-card-close-btn"/);
assert.match(indexSource, /id="mobile-search-card-title">Search</);
assert.match(indexSource, /id="mobile-search-card-search-slot"/);
assert.match(indexSource, /id="mobile-search-card-results-slot"/);
assert.ok(indexSource.indexOf('id="mobile-dock"') < indexSource.indexOf('id="mobile-search-card"'));
assert.ok(indexSource.indexOf('id="mobile-search-card"') < indexSource.indexOf('id="search-control-container"'));

assert.doesNotMatch(indexSource, /id="mobile-search-panel"/);
assert.doesNotMatch(indexSource, /id="mobile-search-actions-card"/);
assert.doesNotMatch(indexSource, /id="mobile-current-map-summary-name"/);
assert.doesNotMatch(indexSource, /id="mobile-current-map-summary-blurb"/);
assert.doesNotMatch(indexSource, /id="mobile-map-list-section"/);
assert.doesNotMatch(indexSource, /id="mobile-search-panel-map-list-slot"/);
assert.doesNotMatch(indexSource, /id="mobile-utility-actions"/);
assert.doesNotMatch(indexSource, /id="mobile-help-btn"/);

assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-info-help-btn \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-launcher-btn \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-dock \{[\s\S]*background: transparent !important;[\s\S]*box-shadow: none !important;/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-sheet-launcher-btn,\s*html\.mobile-layout-v2\.is-mobile-layout #mobile-search-launcher-btn \{[\s\S]*position: absolute;[\s\S]*bottom: calc\(var\(--safe-bottom\) \+ 10px\);/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #map-controls-container \{[\s\S]*flex-direction: column;[\s\S]*align-items: flex-end;/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #sidebar \{[\s\S]*transform: translateX\(calc\(-100% - 22px\)\);/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout \.container\.mobile-surface-atlas #sidebar \{[\s\S]*transform: translateX\(0\) !important;/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #map-blurb \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #map-blurb \{[\s\S]*width: min\(270px,[\s\S]*background: var\(--mobile-surface-bg\);/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-card \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-card \{[\s\S]*bottom: calc\(var\(--safe-bottom\) \+ 66px\);[\s\S]*max-height: min\(45vh,/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout \.container\.mobile-search-card-open #mobile-search-card \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-card-search-slot \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-card-results-slot\[hidden\] \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout \.mobile-map-blurb-card \{/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-card #search-control-container,/);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout \.leaflet-control-minimap \{\s*display: none !important;\s*\}/m);

console.log('mobile shell markup checks passed');
