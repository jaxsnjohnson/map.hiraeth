const assert = require('node:assert/strict');
const fs = require('node:fs');

const indexSource = fs.readFileSync('index.html', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');

assert.match(indexSource, /id="sidebar-tabs" class="sidebar-tabs" role="tablist"[^>]*aria-orientation="horizontal"/);
assert.match(indexSource, /id="sidebar-tab-maps"[^>]*role="tab"[^>]*aria-selected="true"[^>]*aria-controls="sidebar-map-panel"[^>]*tabindex="0"/);
assert.match(indexSource, /id="sidebar-tab-details"[^>]*role="tab"[^>]*aria-selected="false"[^>]*aria-controls="sidebar-poi-panel"[^>]*tabindex="-1"/);
assert.match(indexSource, /id="sidebar-map-panel"[^>]*role="tabpanel"[^>]*aria-labelledby="sidebar-tab-maps"/);
assert.match(indexSource, /id="sidebar-poi-panel"[^>]*role="tabpanel"[^>]*aria-labelledby="sidebar-tab-details"[^>]*hidden/);

assert.match(appSource, /const SIDEBAR_TAB_KEYS = new Set\(\['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'\]\);/);
assert.match(appSource, /function getSidebarTabButtons\(\) \{[\s\S]*querySelectorAll\('\[data-sidebar-tab\]'\)/);
assert.match(appSource, /button\.tabIndex = active \? 0 : -1;/);
assert.match(appSource, /sidebarTabs\.addEventListener\('keydown'[\s\S]*event\.preventDefault\(\);[\s\S]*setSidebarTab\(nextButton\.dataset\.sidebarTab\);[\s\S]*nextButton\.focus\(\);/);

console.log('sidebar tabs accessibility checks passed');
