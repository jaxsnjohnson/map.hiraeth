const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const indexSource = fs.readFileSync('index.html', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');
const styleSource = fs.readFileSync('css/style.css', 'utf8');

assert.doesNotMatch(indexSource, /id="sidebar-tabs"|role="tablist"|role="tabpanel"/);
assert.match(indexSource, /<h1 id="atlas-sidebar-title">Atlas<\/h1>/);
assert.match(indexSource, /id="sidebar-map-panel"[^>]*role="region"[^>]*aria-labelledby="atlas-sidebar-title"/);
assert.match(indexSource, /id="mobile-atlas-close-btn"[^>]*aria-label="Close atlas"/);

assert.match(indexSource, /id="feature-detail-sheet"[^>]*role="dialog"[^>]*aria-modal="false"[^>]*aria-labelledby="feature-detail-title"[^>]*aria-hidden="true"[^>]*hidden/);
assert.match(indexSource, /id="feature-detail-layout-btn"[^>]*aria-label="Dock details to right"[^>]*aria-pressed="false"/);
assert.match(indexSource, /id="feature-detail-close-btn"[^>]*aria-label="Close details"/);
assert.match(indexSource, /id="sidebar-poi-panel" class="feature-detail-content"[^>]*aria-live="polite"/);
assert.match(indexSource, /id="atlas-resize-handle"[^>]*role="separator"[^>]*aria-orientation="vertical"[^>]*tabindex="0"/);
assert.match(indexSource, /id="feature-detail-dock-resize-handle"[^>]*role="separator"[^>]*aria-orientation="vertical"[^>]*tabindex="0"/);
assert.match(indexSource, /id="feature-detail-corner-resize-handle"[^>]*role="separator"[^>]*tabindex="0"/);

const shellDom = new JSDOM(indexSource);
const shellDocument = shellDom.window.document;
assert.equal(
    shellDocument.getElementById('feature-detail-sheet').parentElement,
    shellDocument.querySelector('.container'),
    'expanded detail dialog should cover the Atlas and map as a sibling of both surfaces'
);
shellDom.window.close();

assert.match(appSource, /function openSelectedFeatureDetails\(\)/);
assert.match(appSource, /function closeFeatureDetailSheet\(/);
assert.match(appSource, /function toggleFeatureDetailLayout\(\)/);
assert.match(appSource, /function trapFeatureDetailFocus\(event\)/);
assert.match(appSource, /featureDetailSheet\.addEventListener\('keydown', trapFeatureDetailFocus\)/);
assert.match(appSource, /featureDetailSheet\.setAttribute\('aria-modal', modal \? 'true' : 'false'\)/);
assert.match(appSource, /function syncSidebarInteractionState\(\) \{[\s\S]*sidebar\.inert = hidden;[\s\S]*sidebar\.setAttribute\('aria-hidden', hidden \? 'true' : 'false'\);/m);
assert.match(appSource, /function syncFeatureDetailSheetState\(\) \{[\s\S]*syncSidebarInteractionState\(\);/m);
assert.match(appSource, /if \(mapContainerElement\) mapContainerElement\.inert = modal;/);
assert.match(appSource, /featureDetailLayoutBtn\.setAttribute\('aria-pressed', pressed \? 'true' : 'false'\)/);
assert.match(appSource, /UX_STORAGE_KEYS\.featureDetailMode/);
assert.match(appSource, /function initializeResizableWorkspace\(\)/);
assert.match(appSource, /function syncFeatureDetailSearchVisibility\(\)/);
assert.match(appSource, /const delay = obscuresSearch \? 180 : 320;/);
assert.match(appSource, /className = 'sidebar-detail-technical-toggle'/);
assert.match(appSource, /data-lucide="database"/);
assert.match(appSource, /className = 'sidebar-detail-focus-action'/);
assert.match(appSource, /UX_STORAGE_KEYS\.atlasSidebarWidth/);
assert.match(appSource, /UX_STORAGE_KEYS\.featureDetailDockedWidth/);
assert.match(appSource, /UX_STORAGE_KEYS\.featureDetailGeometry/);
assert.match(appSource, /if \(featureDetailSheetOpen\) \{\s*closeFeatureDetailSheet\(\);/);
assert.match(appSource, /class="popup-detail-expand"[^>]*aria-haspopup="dialog"/);

assert.match(styleSource, /#feature-detail-sheet\.floating \{[\s\S]*width: min\(680px,/m);
assert.match(styleSource, /#feature-detail-sheet\.docked \{[\s\S]*position: relative;[\s\S]*flex: 0 0 var\(--feature-detail-docked-width\);/m);
assert.match(styleSource, /#feature-detail-sheet\.floating\.user-positioned \{[\s\S]*transform: none;/m);
assert.match(styleSource, /\.container\.feature-detail-obscures-search #search-control-container,/);
assert.match(styleSource, /@media \(max-width: 768px\) \{[\s\S]*\.workspace-resize-handle,[\s\S]*display: none !important;/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #feature-detail-sheet \{[\s\S]*max-height: min\(58vh,/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #feature-detail-sheet\.expanded \{[\s\S]*top: calc\(var\(--safe-top\) \+ 8px\)/m);

console.log('Atlas and feature detail sheet accessibility checks passed');
