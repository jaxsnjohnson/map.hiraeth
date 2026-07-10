const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const sidebarStateStart = appSource.indexOf('function syncSidebarInteractionState() {');
const sidebarStateEnd = appSource.indexOf('function openMobileSheet(', sidebarStateStart);
const detailStart = appSource.indexOf('function syncFeatureDetailSheetState() {');
const detailEnd = appSource.indexOf('function syncSidebarPanels() {', detailStart);
if (sidebarStateStart === -1 || sidebarStateEnd === -1 || detailStart === -1 || detailEnd === -1) {
    throw new Error('Could not locate feature detail sheet helpers in js/app.js');
}
const featureDetailSource = [
    appSource.slice(sidebarStateStart, sidebarStateEnd),
    appSource.slice(detailStart, detailEnd)
].join('\n');

const dom = new JSDOM(`<!doctype html><body>
    <div class="container"></div>
    <div id="map" tabindex="-1"></div>
    <div id="feature-detail-backdrop" hidden></div>
    <section id="feature-detail-sheet" hidden tabindex="-1">
        <button id="feature-detail-expand-btn"></button>
        <button id="feature-detail-close-btn"></button>
    </section>
    <button id="popup-trigger">Details</button>
</body>`);

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.container = document.querySelector('.container');
global.bodyElement = document.body;
global.sidebar = document.createElement('aside');
global.sidebar.className = '';
global.mapContainerElement = document.createElement('main');
global.mapElement = document.getElementById('map');
global.featureDetailBackdrop = document.getElementById('feature-detail-backdrop');
global.featureDetailSheet = document.getElementById('feature-detail-sheet');
global.featureDetailExpandBtn = document.getElementById('feature-detail-expand-btn');
global.selectedSidebarFeature = { name: 'Apsley' };
global.selectedSidebarFeatureType = 'poi';
global.featureDetailSheetOpen = false;
global.featureDetailSheetExpanded = false;
global.lastFeatureDetailTrigger = null;
global.isMobileLayoutActive = false;
global.mobileSurfaceMode = null;
global.MOBILE_SURFACE_MODE_ATLAS = 'atlas';
global.isMobileSurfaceMode = mode => global.mobileSurfaceMode === mode;
global.mapBlurbElement = null;
global.refreshLucideIcons = () => {};
global.hasOpenMobileSurface = () => false;
global.closeMobileSheet = () => {};
global.setMapBlurbVisible = () => {};
global.getSidebarFeatureTitle = feature => feature.name;
global.trackAnalytics = () => {};
global.requestAnimationFrame = callback => callback();
global.map = {
    closeCount: 0,
    closePopup() {
        this.closeCount += 1;
    }
};

// eslint-disable-next-line no-eval
eval(featureDetailSource);

const trigger = document.getElementById('popup-trigger');
trigger.focus();
assert.equal(openSelectedFeatureDetails(), false);
assert.equal(global.featureDetailSheetOpen, true);
assert.equal(global.featureDetailSheet.hidden, false);
assert.equal(global.featureDetailSheet.getAttribute('aria-hidden'), 'false');
assert.equal(global.featureDetailSheet.getAttribute('aria-modal'), 'false');
assert.equal(global.container.classList.contains('feature-detail-open'), true);
assert.equal(global.map.closeCount, 1);

toggleFeatureDetailExpanded();
assert.equal(global.featureDetailSheetExpanded, true);
assert.equal(global.featureDetailSheet.classList.contains('expanded'), true);
assert.equal(global.featureDetailSheet.getAttribute('aria-modal'), 'true');
assert.equal(global.featureDetailBackdrop.hidden, false);
assert.equal(global.featureDetailExpandBtn.getAttribute('aria-pressed'), 'true');
assert.equal(global.sidebar.inert, true);
assert.equal(global.sidebar.getAttribute('aria-hidden'), 'true');
assert.equal(global.mapContainerElement.inert, true);

const closeButton = document.getElementById('feature-detail-close-btn');
global.featureDetailSheet.focus();
let reverseTabPrevented = false;
trapFeatureDetailFocus({
    key: 'Tab',
    shiftKey: true,
    preventDefault() { reverseTabPrevented = true; }
});
assert.equal(reverseTabPrevented, true);
assert.equal(document.activeElement, closeButton);

closeButton.focus();
let tabPrevented = false;
trapFeatureDetailFocus({
    key: 'Tab',
    shiftKey: false,
    preventDefault() { tabPrevented = true; }
});
assert.equal(tabPrevented, true);
assert.equal(document.activeElement, global.featureDetailExpandBtn);

closeFeatureDetailSheet({ restoreFocus: false });
assert.equal(global.featureDetailSheetOpen, false);
assert.equal(global.featureDetailSheet.hidden, true);
assert.equal(global.featureDetailBackdrop.hidden, true);
assert.equal(global.container.classList.contains('feature-detail-open'), false);
assert.equal(global.sidebar.inert, false);
assert.equal(global.sidebar.getAttribute('aria-hidden'), 'false');
assert.equal(global.mapContainerElement.inert, false);

dom.window.close();
console.log('feature detail sheet behavior checks passed');
