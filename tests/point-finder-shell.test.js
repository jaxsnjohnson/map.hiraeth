const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('point-finder.html', 'utf8');

assert.match(source, /window\.APP_ASSET_VERSION\s*=\s*"[^"]+"/);
assert.match(source, /<script src="js\/libs\/text-toolbar\.js\?v=[^"]+"><\/script>/);
assert.match(source, /<script src="js\/editor-shared\.js\?v=[^"]+"><\/script>/);

console.log('point-finder shell regression checks passed');
