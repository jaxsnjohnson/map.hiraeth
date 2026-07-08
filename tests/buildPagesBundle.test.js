const assert = require('node:assert/strict');
const fs = require('node:fs');

const { collectPublicMapAssetFiles, createPagesSiteConfig } = require('../scripts/build_pages.js');

const publicMapAssets = collectPublicMapAssetFiles();

[
    'maps/atlas-index.json',
    'maps/Fair-Content.json',
    'maps/Fair-Content.webp',
    'maps/Fair-Content.mini.webp',
    'maps/IceBeach.json',
    'maps/IceBeach.webp',
    'maps/IceBeach.mini.webp'
].forEach((assetPath) => {
    assert.ok(publicMapAssets.includes(assetPath), `Pages bundle should include ${assetPath}`);
});

[
    'maps/maps.json',
    'maps/Archive-2025-09-10-Fair-Content.webp',
    'maps/Old-Lin Map.jpeg',
    'maps/generated/main_continent.json'
].forEach((assetPath) => {
    assert.equal(publicMapAssets.includes(assetPath), false, `Pages bundle should not include ${assetPath}`);
});

assert.equal(
    publicMapAssets.every((assetPath) => assetPath.startsWith('maps/')),
    true,
    'public map asset collector should only return map asset paths'
);

assert.equal(
    publicMapAssets.some((assetPath) => assetPath.startsWith('tile/')),
    false,
    'generated tile paths should not be copied from the source tree'
);

const sourceSiteConfig = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));
const pagesSiteConfig = createPagesSiteConfig(sourceSiteConfig);
assert.equal(sourceSiteConfig.performance.tileAssetRoot, 'dist/tile');
assert.equal(
    pagesSiteConfig.performance.tileAssetRoot,
    'tile',
    'dist-root Pages bundles should keep generated tile URLs relative to the bundle root'
);

console.log('Pages bundle map asset collection checks passed');
