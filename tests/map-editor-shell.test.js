const assert = require('node:assert/strict');
const fs = require('node:fs');

const htmlSource = fs.readFileSync('map-editor.html', 'utf8');
const cssSource = fs.readFileSync('css/map-editor.css', 'utf8');
const jsSource = fs.readFileSync('js/map-editor.js', 'utf8');

assert.match(htmlSource, /id="editor-atlas-tree"/);
assert.match(htmlSource, /id="editor-map"/);
assert.match(htmlSource, /id="map-settings-form"/);
assert.match(htmlSource, /id="editor-feature-form"/);
assert.match(htmlSource, /id="export-current-map-btn"/);
assert.match(htmlSource, /id="export-atlas-structure-btn"/);
assert.match(htmlSource, /css\/map-editor\.css/);
assert.match(htmlSource, /js\/map-editor\.js/);

assert.match(cssSource, /\.map-editor-shell\s*\{/);
assert.match(cssSource, /\.map-editor-tree-list \.map-editor-tree-list\s*\{[\s\S]*margin-left: 14px;/m);
assert.match(cssSource, /\.editor-vertex-icon\s*\{/);

assert.match(jsSource, /beginDrawMode\('point'\)/);
assert.match(jsSource, /beginDrawMode\('region'\)/);
assert.match(jsSource, /beginDrawMode\('line'\)/);
assert.match(jsSource, /exportCurrentMapJson/);
assert.match(jsSource, /exportAtlasStructure/);
assert.match(jsSource, /moveNodeInTree/);
assert.match(jsSource, /renderFeatureInspector/);

console.log('map-editor shell regression checks passed');
