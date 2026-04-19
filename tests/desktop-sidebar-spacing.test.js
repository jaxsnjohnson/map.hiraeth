const assert = require('node:assert/strict');
const fs = require('node:fs');

const styleSource = fs.readFileSync('css/style.css', 'utf8');

assert.match(styleSource, /\.map-item \{[\s\S]*padding: 10px 10px 10px 11px;/m);
assert.match(styleSource, /\.folder-toggle-btn \{[\s\S]*margin: 2px 0 2px 1px;/m);
assert.match(styleSource, /\.folder-main-action \{[\s\S]*padding: 10px 10px 10px 3px;/m);
assert.match(styleSource, /\.nested-list \{ list-style: none; padding: 0; margin: 0 0 0 10px;/m);

assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-panel-map-list-slot \.map-item \{[\s\S]*padding: 9px 10px 9px 12px;/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #mobile-search-panel-map-list-slot \.folder-main-action \{[\s\S]*padding: 9px 10px 9px 2px;/m);

console.log('desktop sidebar spacing regression checks passed');
