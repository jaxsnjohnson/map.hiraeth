const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const styleSource = fs.readFileSync('css/style.css', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');

const finalMobileBlockMarker = '/* Canonical mobile-layout-v2 shell. Keep this block last';
const finalMobileBlockStart = styleSource.indexOf(finalMobileBlockMarker);
assert.notEqual(finalMobileBlockStart, -1);
assert.ok(finalMobileBlockStart > styleSource.lastIndexOf('#mobile-search-panel'));

const finalMobileBlock = styleSource.slice(finalMobileBlockStart);
assert.match(finalMobileBlock, /#mobile-tools-launcher-btn/);
assert.match(finalMobileBlock, /#mobile-tools-card/);
assert.match(finalMobileBlock, /#mobile-tools-actions/);
assert.match(finalMobileBlock, /#route-panel\.mobile-tools-mounted/);
assert.match(finalMobileBlock, /#session-toolkit\.mobile-tools-mounted/);
assert.match(finalMobileBlock, /#gm-pill\.mobile-tools-mounted/);
assert.match(finalMobileBlock, /#sidebar \{[\s\S]*top: calc\(var\(--safe-top\) \+ var\(--mobile-shell-gap\)\) !important;[\s\S]*bottom: calc\(var\(--safe-bottom\) \+ var\(--mobile-shell-gap\)\) !important;[\s\S]*z-index: 1431 !important;[\s\S]*display: flex !important;[\s\S]*transform: translateX\(calc\(-100% - 20px\)\) !important;/m);
assert.match(finalMobileBlock, /\.container\.mobile-surface-atlas #sidebar \{[\s\S]*transform: translateX\(0\) !important;/m);
assert.match(finalMobileBlock, /\.container\.mobile-surface-open #sidebar-backdrop \{[\s\S]*z-index: 1430 !important;/m);
assert.match(finalMobileBlock, /#mobile-search-card \{[\s\S]*bottom: calc\(var\(--safe-bottom\) \+ 70px\) !important;/m);
assert.match(finalMobileBlock, /#mobile-search-card #search-scope-atlas-btn/);

[
    'mobile-markers-btn',
    'mobile-filters-btn',
    'mobile-measure-btn',
    'mobile-sound-btn',
    'mobile-coords-btn',
    'mobile-share-view-btn',
    'mobile-help-btn',
    'mobile-gm-view-btn',
    'mobile-routes-btn',
    'mobile-toolkit-btn'
].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`));
});

assert.match(appSource, /const MOBILE_SURFACE_MODE_TOOLS = 'tools';/);
assert.match(appSource, /function openMobileToolsPanel/);
assert.match(appSource, /function setMobileToolsPanelMode/);
assert.match(appSource, /mobileFiltersBtn\.addEventListener\('click'/);
assert.match(appSource, /mobileRoutesBtn\.addEventListener\('click'/);
assert.match(appSource, /mobileToolkitBtn\.addEventListener\('click'/);

console.log('mobile tools surface checks passed');
