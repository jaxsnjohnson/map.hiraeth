const assert = require('node:assert/strict');
const fs = require('node:fs');

const styleSource = fs.readFileSync('css/style.css', 'utf8');

assert.match(styleSource, /#sidebar \{[\s\S]*width: 286px;[\s\S]*padding: 14px 12px;[\s\S]*gap: 12px;/m);
assert.match(styleSource, /\.atlas-sidebar-header \{[\s\S]*min-height: 50px;[\s\S]*padding: 2px 2px 10px;/m);
assert.match(styleSource, /\.atlas-header-action \{[\s\S]*width: 34px;[\s\S]*height: 34px;[\s\S]*border-radius: 6px;/m);
assert.match(styleSource, /\.map-item \{[\s\S]*min-height: 38px;[\s\S]*padding: 8px 10px;[\s\S]*border-radius: 7px;/m);
assert.match(styleSource, /\.folder-toggle-btn \{[\s\S]*width: 30px;[\s\S]*min-width: 30px;[\s\S]*margin: 3px 0 3px 3px;/m);
assert.match(styleSource, /\.folder-main-action \{[\s\S]*min-height: 38px;[\s\S]*padding: 8px 10px 8px 0;/m);
assert.match(styleSource, /\.nested-list \{[\s\S]*padding: 2px 0 2px 9px;[\s\S]*margin: 2px 0 6px 18px;/m);
assert.match(styleSource, /\.nested-list \.map-item \{[\s\S]*box-sizing: border-box;[\s\S]*min-height: 34px;/m);

assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #sidebar \{[\s\S]*z-index: 1431 !important;[\s\S]*padding: 13px !important;/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #map-list \{[\s\S]*overflow-y: auto !important;/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #map-list \.map-item,\s*html\.mobile-layout-v2\.is-mobile-layout #map-list \.folder-main-action \{[\s\S]*min-height: 38px !important;[\s\S]*border-radius: 6px !important;/m);

console.log('desktop sidebar spacing regression checks passed');
