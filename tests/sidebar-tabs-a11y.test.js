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
assert.match(indexSource, /id="feature-detail-expand-btn"[^>]*aria-label="Expand details"[^>]*aria-pressed="false"/);
assert.match(indexSource, /id="feature-detail-close-btn"[^>]*aria-label="Close details"/);
assert.match(indexSource, /id="sidebar-poi-panel" class="feature-detail-content"[^>]*aria-live="polite"/);

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
assert.match(appSource, /function toggleFeatureDetailExpanded\(\)/);
assert.match(appSource, /function trapFeatureDetailFocus\(event\)/);
assert.match(appSource, /featureDetailSheet\.addEventListener\('keydown', trapFeatureDetailFocus\)/);
assert.match(appSource, /featureDetailSheet\.setAttribute\('aria-modal', modal \? 'true' : 'false'\)/);
assert.match(appSource, /function syncSidebarInteractionState\(\) \{[\s\S]*sidebar\.inert = hidden;[\s\S]*sidebar\.setAttribute\('aria-hidden', hidden \? 'true' : 'false'\);/m);
assert.match(appSource, /function syncFeatureDetailSheetState\(\) \{[\s\S]*syncSidebarInteractionState\(\);/m);
assert.match(appSource, /if \(mapContainerElement\) mapContainerElement\.inert = modal;/);
assert.match(appSource, /featureDetailExpandBtn\.setAttribute\('aria-pressed', featureDetailSheetExpanded \? 'true' : 'false'\)/);
assert.match(appSource, /if \(featureDetailSheetOpen\) \{\s*closeFeatureDetailSheet\(\);/);
assert.match(appSource, /class="popup-detail-expand"[^>]*aria-haspopup="dialog"/);

assert.match(styleSource, /#feature-detail-sheet \{[\s\S]*position: absolute;[\s\S]*width: min\(400px,/m);
assert.match(styleSource, /#feature-detail-sheet\.expanded \{[\s\S]*width: min\(760px,/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #feature-detail-sheet \{[\s\S]*max-height: min\(58vh,/m);
assert.match(styleSource, /html\.mobile-layout-v2\.is-mobile-layout #feature-detail-sheet\.expanded \{[\s\S]*top: calc\(var\(--safe-top\) \+ 8px\)/m);

console.log('Atlas and feature detail sheet accessibility checks passed');
