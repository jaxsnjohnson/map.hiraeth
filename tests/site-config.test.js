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

assert.deepEqual(AppConfig.validateConfig(siteConfig), []);

const resolved = AppConfig.normalizeConfig(siteConfig);
assert.equal(resolved.brand.siteName, siteConfig.brand.siteName);
assert.equal(resolved.assets.version, siteConfig.assets.version);
assert.equal(resolved.theme.tokens.light['--font-family-main'], resolved.theme.fontFamilyMain);
assert.equal(resolved.theme.tokens.dark['--font-family-main'], resolved.theme.fontFamilyMain);
assert.equal(resolved.features.lowQualityMode, undefined);
assert.equal(resolved.performance.lowQualityMode, false);


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

assertLocalFileExists(resolved.brand.icons.favicon16, 'brand.icons.favicon16');
assertLocalFileExists(resolved.brand.icons.favicon32, 'brand.icons.favicon32');
assertLocalFileExists(resolved.brand.icons.appleTouchIcon, 'brand.icons.appleTouchIcon');
assertLocalFileExists(resolved.assets.cloudTexture, 'assets.cloudTexture');
assertLocalFileExists(resolved.assets.previewImage, 'assets.previewImage');
Object.entries(resolved.assets.poiIcons).forEach(([group, iconPath]) => {
    assertLocalFileExists(iconPath, `assets.poiIcons.${group}`);
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
