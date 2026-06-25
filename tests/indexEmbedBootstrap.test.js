const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');

assert.match(indexSource, /window\.__INITIAL_EMBEDDED_VIEW__\s*=\s*isEmbed/);
assert.match(indexSource, /document\.documentElement\.classList\.toggle\("embedded-view",\s*isEmbed\)/);
assert.match(indexSource, /params\.get\("embed"\)\s*===\s*"true"\s*\|\|\s*params\.get\("hideUI"\)\s*===\s*"true"/);
assert.match(indexSource, /params\.get\("mobileLayout"\)/);
assert.match(indexSource, /safeSet\(mode\)/);
assert.match(indexSource, /document\.documentElement\.classList\.toggle\("mobile-layout-v2",\s*mode === "v2"\)/);
assert.match(indexSource, /function preloadRuntimeAssets\(\)/);
assert.match(indexSource, /appendPreload\(`maps\/atlas-index\.json\?v=\$\{version\}`, "fetch"/);
assert.match(indexSource, /window\.__HIRAETH_DIRECT_MAP_PREVIEW__ = previewOverrides\[directMapId\] \|\| `maps\/\$\{directMapId\}\.mini\.webp`/);
assert.match(indexSource, /appendPreload\(window\.__HIRAETH_DIRECT_MAP_PREVIEW__, "image"\)/);
assert.match(indexSource, /main_continent: "maps\/Fair-Content\.mini\.webp"/);
assert.match(indexSource, /function mountBootstrapMapPreview\(\)/);
assert.match(indexSource, /previewImage\.id = "map-bootstrap-preview"/);
assert.match(indexSource, /loadingElement\.style\.display = "none"/);

console.log('index embed bootstrap checks passed');
