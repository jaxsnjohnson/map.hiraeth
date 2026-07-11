const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/starfield.js', 'utf8');

assert.match(source, /function syncCanvasToContainer\(now = performance\.now\(\)\) \{/);
assert.match(source, /function scheduleAnimationLoop\(\) \{[\s\S]*!shouldRender\(\)[\s\S]*requestAnimationFrame\(loop\)/m);
assert.match(source, /function syncAnimationState\(now = performance\.now\(\)\) \{[\s\S]*cancelAnimationLoop\(\);[\s\S]*clearCanvas\(\);/m);
assert.match(source, /document\.addEventListener\('visibilitychange',[\s\S]*syncAnimationState\(lastFrame\);/m);
assert.match(source, /const themeObserver = new MutationObserver\(\(\) => \{[\s\S]*syncAnimationState\(\);/m);
assert.match(source, /if \(typeof ResizeObserver === 'function'\) \{[\s\S]*layoutObserver\.observe\(container\);/m);
assert.match(source, /window\.addEventListener\('resize', debouncedResize\);/);

console.log('starfield resize regression checks passed');
