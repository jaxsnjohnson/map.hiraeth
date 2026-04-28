const assert = require('node:assert/strict');
const fs = require('node:fs');

const htmlSource = fs.readFileSync('map-editor.html', 'utf8');
const cssSource = fs.readFileSync('css/map-editor.css', 'utf8');
const jsSource = fs.readFileSync('js/map-editor.js', 'utf8');

assert.match(htmlSource, /id="editor-atlas-tree"/);
assert.match(htmlSource, /id="editor-map"/);
assert.match(htmlSource, /id="map-settings-form"/);
assert.match(htmlSource, /id="map-group-input"/);
assert.match(htmlSource, /id="editor-feature-form"/);
assert.match(htmlSource, /id="export-current-map-btn"/);
assert.match(htmlSource, /id="export-atlas-structure-btn"/);
assert.match(htmlSource, /id="editor-map-empty-title"/);
assert.match(htmlSource, /id="editor-map-empty-copy"/);
assert.match(htmlSource, /id="editor-map-empty-detail"/);
assert.match(htmlSource, /Drag POI markers to move them/);
assert.match(htmlSource, /css\/map-editor\.css/);
assert.match(htmlSource, /js\/map-editor\.js/);

assert.match(cssSource, /\.map-editor-shell\s*\{/);
assert.match(cssSource, /\.map-editor-map-frame\s*\{[\s\S]*display: flex;/m);
assert.match(cssSource, /#editor-map\s*\{[\s\S]*min-height: 480px;[\s\S]*position: relative;[\s\S]*overflow: hidden;/m);
assert.match(cssSource, /\.map-editor-tree-list \.map-editor-tree-list\s*\{[\s\S]*margin-left: 14px;/m);
assert.match(cssSource, /\.map-editor-tree-group-header\s*\{/);
assert.match(cssSource, /#editor-map \.leaflet-map-pane \{ z-index: 100; \}/);
assert.match(cssSource, /#editor-map \.leaflet-image-layer \{[\s\S]*opacity: 1 !important;[\s\S]*visibility: visible !important;/m);
assert.match(cssSource, /\.map-editor-empty-detail\s*\{/);
assert.match(cssSource, /\.editor-vertex-icon\s*\{/);

assert.match(jsSource, /beginDrawMode\('point'\)/);
assert.match(jsSource, /beginDrawMode\('region'\)/);
assert.match(jsSource, /beginDrawMode\('line'\)/);
assert.match(jsSource, /exportCurrentMapJson/);
assert.match(jsSource, /exportAtlasStructure/);
assert.match(jsSource, /getMapContainerSize/);
assert.match(jsSource, /queueMapViewportReset/);
assert.match(jsSource, /state\.map\.setView\(\[0, 0\], 0, \{ animate: false \}\)/);
assert.match(jsSource, /moveNodeInTree/);
assert.match(jsSource, /renderFeatureInspector/);
assert.match(jsSource, /setMapEmptyState/);
assert.match(jsSource, /getMapPresetGroupLabel/);
assert.match(jsSource, /imageLayer\.once\('load'/);
assert.match(jsSource, /imageLayer\.once\('error'/);

console.log('map-editor shell regression checks passed');
