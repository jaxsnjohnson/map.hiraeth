const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const mapEditorSource = fs.readFileSync('map-editor.html', 'utf8');
const appConfigSource = fs.readFileSync('js/app-config.js', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');
const swSource = fs.readFileSync('sw.js', 'utf8');
const versionMatch = appConfigSource.match(/version:\s*'([^']+)'/);
assert.ok(versionMatch, 'Could not find default asset version in app config');
const appConfigVersion = versionMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

assert.match(indexSource, new RegExp(`<script src="js/app-config\\.js\\?v=${appConfigVersion}"></script>`));
assert.match(mapEditorSource, new RegExp(`<script src="js/app-config\\.js\\?v=${appConfigVersion}"></script>`));
assert.match(indexSource, /window\.APP_ASSET_VERSION\s*=\s*window\.AppConfig \? window\.AppConfig\.get\("assets\.version", "0"\) : "0"/);
assert.match(indexSource, /window\.AppConfig\.get\("assets\.stylesheets"/);
assert.match(indexSource, /link\.href = `\$\{href\}\?v=\$\{version\}`/);
assert.match(indexSource, /script\.src = `\$\{src\}\?v=\$\{version\}`/);

assert.match(appSource, /const swUrl = `sw\.js\?v=\$\{encodeURIComponent\(window\.APP_ASSET_VERSION \|\| '0'\)\}`/);
assert.match(appSource, /navigator\.serviceWorker\.register\(swUrl\)/);

assert.match(swSource, /const VERSION = new URL\(self\.location\.href\)\.searchParams\.get\('v'\) \|\| '0';/);
assert.match(swSource, /function isVersionedShellRequest\(url\) \{/);
assert.match(swSource, /return url\.searchParams\.has\('v'\);/);
assert.match(swSource, /: networkFirst\(request, SHELL_CACHE\)/);
assert.match(swSource, /const DEFAULT_VERSIONED_SHELL_ASSETS = \[[\s\S]*'css\/style\.css'/);
assert.match(swSource, /const DEFAULT_VERSIONED_SHELL_ASSETS = \[[\s\S]*'css\/leaflet\.css'/);
assert.match(swSource, /const DEFAULT_VERSIONED_SHELL_ASSETS = \[[\s\S]*'js\/app-config\.js'/);
assert.match(swSource, /const DEFAULT_VERSIONED_SHELL_ASSETS = \[[\s\S]*'js\/shared-utils\.js'/);
assert.match(swSource, /const DEFAULT_VERSIONED_SHELL_ASSETS = \[[\s\S]*'js\/libs\/leaflet\.js'/);
assert.match(swSource, /const DEFAULT_VERSIONED_SHELL_ASSETS = \[[\s\S]*'js\/libs\/lucide\.min\.js'/);
assert.match(swSource, /const DEFAULT_VERSIONED_SHELL_ASSETS = \[[\s\S]*'js\/libs\/purify\.min\.js'/);
assert.match(swSource, /const DEFAULT_VERSIONED_SHELL_ASSETS = \[[\s\S]*'maps\/atlas-index\.json'/);
assert.match(swSource, /const DEFAULT_STATIC_SHELL_ASSETS = \[[\s\S]*'images\/sky-background\.webp'/);
assert.match(swSource, /site\.config\.json\?v=\$\{VERSION\}/);
assert.match(swSource, /cache\.addAll\(\[\.\.\.configuredAssets\.static, \.\.\.versionedShellAssets\]\)/);

console.log('shell versioning regression checks passed');
