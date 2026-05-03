const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');

assert.match(indexSource, /<h1 id="map-chooser-title">MAP ATLAS<\/h1>/);
assert.match(appSource, /function getMapChooserDescriptionText\(mapInfo\) \{[\s\S]*selectorDescription \|\|[\s\S]*summary \|\|[\s\S]*description \|\|[\s\S]*blurb \|\|[\s\S]*''/);
assert.match(appSource, /sandbox\.body\.textContent/);
assert.match(appSource, /description\.textContent = getMapChooserDescriptionText\(mapInfo\);/);

console.log('map chooser copy regression checks passed');
