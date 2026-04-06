const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert.match(appSource, /const mapOptions = \{[\s\S]*minZoom:\s*-4,/);
assert.match(appSource, /const mapOptions = \{[\s\S]*maxZoom:\s*4,/);

console.log('map options regression checks passed');
