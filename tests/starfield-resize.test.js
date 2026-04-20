const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/starfield.js', 'utf8');

assert.match(source, /function syncCanvasToContainer\(now = performance\.now\(\)\) \{/);
assert.match(source, /const resized = resize\(\);[\s\S]*if \(resized \|\| shouldRender\(\)\) \{/m);
assert.match(source, /if \(typeof ResizeObserver === 'function'\) \{[\s\S]*layoutObserver\.observe\(container\);/m);
assert.match(source, /window\.addEventListener\('resize', debouncedResize\);/);

console.log('starfield resize regression checks passed');
