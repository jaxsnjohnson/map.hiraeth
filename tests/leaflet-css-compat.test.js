const assert = require('node:assert/strict');
const fs = require('node:fs');

const leafletCss = fs.readFileSync('css/leaflet.css', 'utf8');

const tileBlendRule = /\.leaflet-container img\.leaflet-tile\s*\{(?<body>[\s\S]*?)\}/.exec(leafletCss);

assert.ok(tileBlendRule, 'Leaflet tile images should keep an explicit compatibility rule');
assert.match(tileBlendRule.groups.body, /issues\.chromium\.org\/issues\/40084005/);
assert.match(tileBlendRule.groups.body, /formerly 600120/);
assert.match(tileBlendRule.groups.body, /mix-blend-mode:\s*plus-lighter;/);

console.log('Leaflet CSS compatibility checks passed');
