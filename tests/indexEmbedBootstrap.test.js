const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const indexSource = fs.readFileSync('index.html', 'utf8');
const styleSource = fs.readFileSync('css/style.css', 'utf8');

assert.match(indexSource, /window\.__INITIAL_EMBEDDED_VIEW__\s*=\s*isEmbed/);
assert.match(indexSource, /document\.documentElement\.classList\.toggle\("embedded-view",\s*isEmbed\)/);
assert.match(indexSource, /params\.get\("embed"\)\s*===\s*"true"\s*\|\|\s*params\.get\("hideUI"\)\s*===\s*"true"/);
assert.match(indexSource, /function applyInitialMapChooserMode\(\)/);
assert.ok(
    indexSource.includes('const rawMapId = String(window.location.hash || "").replace(/^#/, "").split("-s=")[0] || "";'),
    'initial map chooser mode should inspect the hash before app startup.'
);
assert.match(indexSource, /window\.__INITIAL_MAP_CHOOSER_OPEN__\s*=\s*shouldOpenChooser/);
assert.match(indexSource, /document\.documentElement\.classList\.toggle\("map-chooser-first",\s*shouldOpenChooser\)/);
assert.match(indexSource, /params\.get\("mobileLayout"\)/);
assert.match(indexSource, /safeSet\(mode\)/);
assert.match(indexSource, /document\.documentElement\.classList\.toggle\("mobile-layout-v2",\s*mode === "v2"\)/);
assert.match(indexSource, /function preloadRuntimeAssets\(\)/);
assert.match(indexSource, /function preloadDirectMapAssets\(\)/);
assert.ok(
    indexSource.indexOf('<link rel="stylesheet" href="css/leaflet.css') < indexSource.indexOf('<script src="js/app-config.js'),
    'core stylesheets should begin loading before the blocking app config script.'
);
assert.ok(
    indexSource.indexOf('function preloadDirectMapAssets()') < indexSource.indexOf('<link rel="stylesheet" href="css/leaflet.css'),
    'direct map assets should be requested before render-blocking stylesheets.'
);
assert.match(indexSource, /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/);
assert.match(indexSource, /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/);
assert.ok(
    indexSource.indexOf('<link rel="preload" href="js/app.js') < indexSource.indexOf('<script src="js/app-config.js'),
    'runtime scripts should be discoverable before the blocking app config script.'
);
assert.match(indexSource, /if \(options\.fetchPriority\) link\.fetchPriority = options\.fetchPriority/);
assert.match(indexSource, /appendPreload\(`maps\/atlas-index\.json\?v=\$\{version\}`, "fetch"/);
assert.match(indexSource, /const directMapPreview = previewOverrides\[directMapId\] \|\| `maps\/\$\{directMapId\}\.mini\.webp`/);
assert.match(indexSource, /window\.__HIRAETH_DIRECT_MAP_PREVIEW__ = `\$\{directMapPreview\}\$\{previewSeparator\}v=\$\{version\}`/);
assert.match(indexSource, /window\.__HIRAETH_DIRECT_MAP_DATA_URL__ = dataUrlOverrides\[directMapId\] \|\| `maps\/\$\{directMapId\}\.json`/);
assert.match(indexSource, /appendPreload\(window\.__HIRAETH_DIRECT_MAP_PREVIEW__, "image", \{ fetchPriority: "high" \}\)/);
assert.match(indexSource, /appendPreload\(`\$\{window\.__HIRAETH_DIRECT_MAP_DATA_URL__\}\?v=\$\{version\}`, "fetch", \{[\s\S]*fetchPriority: "high"[\s\S]*\}\)/);
assert.match(indexSource, /main_continent: "maps\/Fair-Content\.mini\.webp"/);
assert.match(indexSource, /main_continent: "maps\/Fair-Content\.json"/);
assert.match(indexSource, /localStorage\.getItem\("lastMapId"\)/);
assert.match(indexSource, /directMapId = \/\^\[A-Za-z0-9\._-\]\+\$\/\.test\(storedMapId\) \? storedMapId : "main_continent"/);
assert.match(indexSource, /document\.documentElement\.classList\.add\("bootstrap-map-preview-loading"\);[\s\S]*appendPreload\(window\.__HIRAETH_DIRECT_MAP_PREVIEW__, "image"/);
assert.match(indexSource, /html\.bootstrap-map-preview-loading #loading-indicator\.initial-loader \{[\s\S]*height: 4px;[\s\S]*pointer-events: none;/);
assert.match(indexSource, /html\.bootstrap-map-preview-loading #loading-indicator\.initial-loader \.progress-container \{[\s\S]*width: 100%;[\s\S]*height: 4px;/);
assert.doesNotMatch(indexSource, /html\.bootstrap-map-preview-loading #(sidebar|toggle-sidebar-btn)\b/);
assert.doesNotMatch(indexSource, /class="spinner"/);
assert.doesNotMatch(styleSource, /\.spinner\b/);
assert.match(indexSource, /function mountBootstrapMapPreview\(\)/);
assert.match(indexSource, /previewImage\.id = "map-bootstrap-preview"/);
assert.match(indexSource, /previewImage\.fetchPriority = "high"/);
assert.match(indexSource, /document\.documentElement\.classList\.add\("bootstrap-map-preview-loading"\)/);
assert.match(indexSource, /if \(progressBar\) progressBar\.style\.width = "10%"/);
assert.doesNotMatch(indexSource, /loadingElement\.style\.display = "none"/);
assert.match(indexSource, /previewImage\.onerror = \(\) => \{[\s\S]*document\.documentElement\.classList\.remove\("bootstrap-map-preview-loading"\)/);
assert.match(indexSource, /<section id="map-chooser" class="map-chooser"[^>]*aria-hidden="true" hidden>/);
assert.match(indexSource, /function applyInitialMapChooserDomState\(\)/);
assert.match(indexSource, /window\.__INITIAL_MAP_CHOOSER_OPEN__ !== true/);
assert.match(indexSource, /chooser\.hidden = false/);
assert.match(indexSource, /chooser\.setAttribute\("aria-hidden", "false"\)/);
assert.match(indexSource, /document\.body\.classList\.add\("map-chooser-open"\)/);
assert.match(indexSource, /body\.map-chooser-open \.container \{\s*display: none !important;\s*\}/);
assert.match(styleSource, /body\.map-chooser-open \.container,\s*body\.map-chooser-open #loading-indicator,/);

const chooserDomScriptIndex = indexSource.indexOf('function applyInitialMapChooserDomState()');
const mapContainerIndex = indexSource.indexOf('<div class="container">');
assert.ok(
    chooserDomScriptIndex > -1 && chooserDomScriptIndex < mapContainerIndex,
    'initial chooser DOM state should be applied before the map container can render.'
);

async function createStartupDom(url, errors = []) {
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', error => errors.push(error));
    const dom = new JSDOM(indexSource, {
        url,
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        virtualConsole
    });
    await new Promise(resolve => dom.window.queueMicrotask(resolve));
    return dom;
}

async function main() {
    const defaultDom = await createStartupDom('http://127.0.0.1:4175/');
    const defaultChooser = defaultDom.window.document.getElementById('map-chooser');
    assert.equal(defaultDom.window.__INITIAL_MAP_CHOOSER_OPEN__, false);
    assert.equal(defaultChooser.hidden, true, 'default route should start map-first with Atlas as primary navigation.');
    assert.equal(defaultChooser.getAttribute('aria-hidden'), 'true');
    assert.equal(defaultDom.window.document.body.classList.contains('map-chooser-open'), false);
    assert.notEqual(
        defaultDom.window.getComputedStyle(defaultDom.window.document.querySelector('.container')).display,
        'none',
        'default route should paint the map shell immediately.'
    );
    defaultDom.window.close();

    const galleryDom = await createStartupDom('http://127.0.0.1:4175/?gallery=true');
    const galleryChooser = galleryDom.window.document.getElementById('map-chooser');
    assert.equal(galleryDom.window.__INITIAL_MAP_CHOOSER_OPEN__, true);
    assert.equal(galleryChooser.hidden, false, 'gallery route should expose the visual map chooser.');
    assert.equal(galleryChooser.getAttribute('aria-hidden'), 'false');
    assert.equal(galleryDom.window.document.body.classList.contains('map-chooser-open'), true);
    galleryDom.window.close();

    const directMapDom = await createStartupDom('http://127.0.0.1:4175/#main_continent-s=o');
    const directMapChooser = directMapDom.window.document.getElementById('map-chooser');
    assert.equal(directMapDom.window.__INITIAL_MAP_CHOOSER_OPEN__, false);
    assert.equal(directMapChooser.hidden, true, 'direct map hash should keep chooser hidden for map-first startup.');
    assert.equal(directMapChooser.getAttribute('aria-hidden'), 'true');
    assert.equal(directMapDom.window.document.body.classList.contains('map-chooser-open'), false);
    assert.notEqual(
        directMapDom.window.getComputedStyle(directMapDom.window.document.querySelector('.container')).display,
        'none',
        'direct map startup should still show the map shell.'
    );
    directMapDom.window.close();

    const embeddedDom = await createStartupDom('http://127.0.0.1:4175/?embed=true');
    const embeddedChooser = embeddedDom.window.document.getElementById('map-chooser');
    assert.equal(embeddedDom.window.__INITIAL_MAP_CHOOSER_OPEN__, false);
    assert.equal(embeddedChooser.hidden, true, 'embedded view should keep chooser hidden for map-first startup.');
    assert.equal(embeddedDom.window.document.body.classList.contains('map-chooser-open'), false);
    embeddedDom.window.close();

    const malformedHashErrors = [];
    const malformedHashDom = await createStartupDom('http://127.0.0.1:4175/#bad%', malformedHashErrors);
    assert.deepEqual(malformedHashErrors, []);
    assert.equal(malformedHashDom.window.__INITIAL_EFFECTIVE_THEME__, 'light');
    assert.equal(malformedHashDom.window.__INITIAL_MAP_CHOOSER_OPEN__, false);
    malformedHashDom.window.close();

    console.log('index embed bootstrap checks passed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
