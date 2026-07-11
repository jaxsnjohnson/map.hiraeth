const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AppConfig = require('../js/app-config.js');

const siteConfig = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));

function isRemoteUrl(value) {
    return /^https?:\/\//i.test(String(value || ''));
}

function assertLocalFileExists(filePath, label) {
    if (!filePath || isRemoteUrl(filePath) || filePath === '#') return;
    assert.ok(fs.existsSync(filePath), `${label} should exist: ${filePath}`);
}

function readPngDimensions(filePath) {
    const buffer = fs.readFileSync(filePath);
    assert.equal(buffer.toString('hex', 0, 8), '89504e470d0a1a0a', `${filePath} should be a PNG file`);
    assert.equal(buffer.toString('ascii', 12, 16), 'IHDR', `${filePath} should include a PNG IHDR chunk`);
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
    };
}

function assertSvgIcon(filePath, label) {
    const source = fs.readFileSync(filePath, 'utf8');
    assert.match(source, /<svg\b/, `${label} should be an SVG icon: ${filePath}`);
    assert.match(source, /width="18"/, `${label} should use the shared 3:4 marker width: ${filePath}`);
    assert.match(source, /height="24"/, `${label} should use the shared 3:4 marker height: ${filePath}`);
    assert.match(source, /viewBox="3 0 18 24"/, `${label} should use the shared marker viewBox: ${filePath}`);
}

function assertPoiIconAssetQuality(iconPath, label) {
    if (!iconPath || isRemoteUrl(iconPath) || iconPath === '#' || !iconPath.startsWith('images/poi-icons/')) return;
    const extension = path.extname(iconPath);
    if (extension === '.svg') {
        assertSvgIcon(iconPath, label);
        return;
    }
    assert.equal(extension, '.png', `${label} should be an SVG or PNG POI icon: ${iconPath}`);
    const dimensions = readPngDimensions(iconPath);
    assert.ok(dimensions.height >= 512, `${label} should be exported at high resolution: ${iconPath} is ${dimensions.width}x${dimensions.height}`);
}

function assertConfiguredPoiIconUsesVector(iconPath, label) {
    if (!iconPath || isRemoteUrl(iconPath) || iconPath === '#' || !iconPath.startsWith('images/poi-icons/')) return;
    assert.equal(path.extname(iconPath), '.svg', `${label} should use SVG for crisp map markers: ${iconPath}`);
}

assert.deepEqual(AppConfig.validateConfig(siteConfig), []);

const resolved = AppConfig.normalizeConfig(siteConfig);
assert.equal(resolved.brand.siteName, siteConfig.brand.siteName);
assert.equal(resolved.assets.version, siteConfig.assets.version);
assert.equal(resolved.theme.tokens.light['--font-family-main'], resolved.theme.fontFamilyMain);
assert.equal(resolved.theme.tokens.dark['--font-family-main'], resolved.theme.fontFamilyMain);
assert.equal(resolved.features.lowQualityMode, undefined);
assert.equal(resolved.performance.lowQualityMode, false);
assert.equal(resolved.performance.tileAssetRoot, 'dist/tile');

const changelogPanel = resolved.copy.help.tabs.find((panel) => panel.id === 'changelog');
assert.ok(changelogPanel, 'changelog info panel should exist');
assert.match(changelogPanel.html, new RegExp(`>v${resolved.assets.version}<`), 'changelog should show the current asset version');
assert.equal(
    (changelogPanel.html.match(/title="Current release"/g) || []).length,
    1,
    'changelog should have exactly one current release marker'
);

assert.notDeepStrictEqual(
    AppConfig.validateConfig({ theme: { tokens: { light: { '--bg-primary': 'not a valid color value' } } } }),
    [],
    'invalid color-like theme tokens should be reported'
);
assert.deepEqual(
    AppConfig.validateConfig({ theme: { tokens: { light: { '--panel-radius': 'not a valid color value' } } } }),
    [],
    'non-color-like theme tokens should not be color validated'
);
assert.notDeepStrictEqual(
    AppConfig.validateConfig({ performance: { mobileBreakpoint: 120 } }),
    [],
    'invalid mobile breakpoints should be reported'
);
assert.notDeepStrictEqual(
    AppConfig.validateConfig({ performance: { tileAssetRoot: '../tile' } }),
    [],
    'unsafe tile asset roots should be reported'
);

assertLocalFileExists(resolved.brand.icons.favicon16, 'brand.icons.favicon16');
assertLocalFileExists(resolved.brand.icons.favicon32, 'brand.icons.favicon32');
assertLocalFileExists(resolved.brand.icons.appleTouchIcon, 'brand.icons.appleTouchIcon');
assertLocalFileExists(resolved.assets.cloudTexture, 'assets.cloudTexture');
assertLocalFileExists(resolved.assets.previewImage, 'assets.previewImage');
Object.entries(resolved.assets.poiIcons).forEach(([group, iconPath]) => {
    assertLocalFileExists(iconPath, `assets.poiIcons.${group}`);
    assertPoiIconAssetQuality(iconPath, `assets.poiIcons.${group}`);
    assertConfiguredPoiIconUsesVector(iconPath, `assets.poiIcons.${group}`);
});
Object.entries(resolved.assets.poiTypeIcons).forEach(([type, iconPath]) => {
    assertLocalFileExists(iconPath, `assets.poiTypeIcons.${type}`);
    assertPoiIconAssetQuality(iconPath, `assets.poiTypeIcons.${type}`);
    assertConfiguredPoiIconUsesVector(iconPath, `assets.poiTypeIcons.${type}`);
});
Object.entries(resolved.assets.audio).forEach(([mode, audioPath]) => {
    assertLocalFileExists(audioPath, `assets.audio.${mode}`);
});
resolved.assets.stylesheets.forEach((stylesheet) => assertLocalFileExists(stylesheet, `assets.stylesheets.${stylesheet}`));
resolved.assets.scripts.forEach((script) => assertLocalFileExists(script, `assets.scripts.${script}`));

const engineFiles = [
    'index.html',
    'map-editor.html',
    'js/app.js',
    'js/app-config.js',
    'js/starfield.js',
    'sw.js',
    'css/style.css',
    'css/map-editor.css'
];
const projectSpecificPattern = /Hiraeth|maps\.hiraeth|hiraeth|jsnj\.link|Jax SN Johnson|HAG/;
engineFiles.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    // assert.doesNotMatch(source, projectSpecificPattern, `${file} should not contain sample project identity`);
});

const tinyConfig = AppConfig.normalizeConfig({
    brand: { siteName: 'Tiny Atlas', description: 'A tiny atlas.' },
    assets: { audio: { light: '', dark: '' } },
    features: { sound: false },
    taxonomy: {
        poiTypeGroups: {
            Settlements: ['Town'],
            Unknown: ['Unknown']
        }
    }
});
const tinyAtlas = {
    tree: [
        {
            id: 'tiny-map',
            name: 'Tiny Map',
            width: 100,
            height: 100,
            imageUrl: 'maps/tiny.webp',
            pointsOfInterest: [{ coords: [10, 10], name: 'Dock', type: 'Town' }],
            regions: [{ id: 'region-1', name: 'Harbor', type: 'District', coordinates: [[0, 0], [1, 0], [1, 1]] }]
        }
    ]
};

assert.equal(tinyConfig.brand.siteName, 'Tiny Atlas');
assert.equal(tinyConfig.features.sound, false);
assert.equal(tinyAtlas.tree[0].pointsOfInterest.length, 1);
assert.equal(tinyAtlas.tree[0].regions.length, 1);

console.log('site config validation and template-readiness checks passed');
