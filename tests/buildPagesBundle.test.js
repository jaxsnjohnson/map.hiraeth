const assert = require('node:assert/strict');

const { collectPublicMapAssetFiles } = require('../scripts/build_pages.js');

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

console.log('Pages bundle map asset collection checks passed');
