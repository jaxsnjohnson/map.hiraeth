const assert = require('node:assert/strict');
const fs = require('node:fs');

const styleSource = fs.readFileSync('css/style.css', 'utf8');

assert.match(styleSource, /\.map-item \{[\s\S]*padding: 10px 10px 10px 8px;/m);
assert.match(styleSource, /\.folder-toggle-btn \{[\s\S]*width: 26px;[\s\S]*min-width: 26px;[\s\S]*margin: 2px 0 2px 0;/m);
assert.match(styleSource, /\.folder-main-action \{[\s\S]*padding: 10px 10px 10px 1px;/m);
assert.match(styleSource, /\.nested-list \{ list-style: none; padding: 0; margin: 0 0 0 6px;/m);

assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #sidebar \{[\s\S]*z-index: 1431 !important;[\s\S]*padding: 13px !important;/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #map-list \{[\s\S]*overflow-y: auto !important;/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #map-list \.map-item,\s*html\.mobile-layout-v2\.is-mobile-layout #map-list \.folder-main-action \{[\s\S]*min-height: 38px !important;[\s\S]*border-radius: 6px !important;/m);

console.log('desktop sidebar spacing regression checks passed');
