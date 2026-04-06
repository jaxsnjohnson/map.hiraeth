const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');
const swSource = fs.readFileSync('sw.js', 'utf8');

assert.match(indexSource, /window\.APP_ASSET_VERSION\s*=\s*"[^"]+"/);
assert.match(indexSource, /const localStylesheets = \[\s*"css\/style\.css",\s*"css\/stars\.css",\s*"css\/Control\.MiniMap\.min\.css"\s*\]/);
assert.match(indexSource, /link\.href = `\$\{href\}\?v=\$\{version\}`/);
assert.match(indexSource, /script\.src = `\$\{src\}\?v=\$\{version\}`/);

assert.match(appSource, /const swUrl = `sw\.js\?v=\$\{encodeURIComponent\(window\.APP_ASSET_VERSION \|\| '0'\)\}`/);
assert.match(appSource, /navigator\.serviceWorker\.register\(swUrl\)/);

assert.match(swSource, /const VERSION = new URL\(self\.location\.href\)\.searchParams\.get\('v'\) \|\| '0';/);
assert.match(swSource, /const VERSIONED_SHELL_ASSETS = \[[\s\S]*`css\/style\.css\?v=\$\{VERSION\}`/);
assert.match(swSource, /const VERSIONED_SHELL_ASSETS = \[[\s\S]*`js\/app\.js\?v=\$\{VERSION\}`/);
assert.match(swSource, /const VERSIONED_SHELL_ASSETS = \[[\s\S]*`maps\/atlas-index\.json\?v=\$\{VERSION\}`/);
assert.match(swSource, /cache\.addAll\(\[\.\.\.STATIC_SHELL_ASSETS, \.\.\.VERSIONED_SHELL_ASSETS\]\)/);

console.log('shell versioning regression checks passed');
