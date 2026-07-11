const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');

assert.match(indexSource, /<h1 id="map-chooser-title">MAP ATLAS<\/h1>/);
assert.match(indexSource, /id="map-chooser-close-btn"[^>]+aria-label="Return to map"/);
assert.match(indexSource, /<header class="atlas-sidebar-header">[\s\S]*?<h1 id="atlas-sidebar-title">Atlas<\/h1>[\s\S]*?id="sidebar-back-to-chooser"[\s\S]*?<\/header>/);
assert.match(indexSource, /<section id="sidebar-map-panel" class="sidebar-map-panel" role="region" aria-labelledby="atlas-sidebar-title">\s*<ul id="map-list">/);
assert.match(appSource, /params\.get\('gallery'\) === 'true'/);
assert.match(appSource, /galleryParams\.set\('gallery', 'true'\)/);
assert.match(appSource, /mapChooserOverlay: true/);
assert.match(appSource, /function closeMapChooserToMap\([\s\S]*history\.back\(\)[\s\S]*findFirstLoadableIdRecursive\(mapData\)/);
assert.match(appSource, /if \(mapChooserElement && !mapChooserElement\.hidden\) \{[\s\S]*closeMapChooserToMap\(\)/);
assert.match(appSource, /function getMapChooserDescriptionText\(mapInfo\) \{[\s\S]*selectorDescription \|\|[\s\S]*summary \|\|[\s\S]*description \|\|[\s\S]*blurb \|\|[\s\S]*''/);
assert.match(appSource, /sandbox\.body\.textContent/);
assert.match(appSource, /description\.textContent = getMapChooserDescriptionText\(mapInfo\);/);

console.log('map chooser copy regression checks passed');
