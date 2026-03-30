const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionRange(startMarker, endMarker) {
    const start = appSource.indexOf(startMarker);
    if (start === -1) {
        throw new Error(`Could not find start marker: ${startMarker}`);
    }
    const end = endMarker ? appSource.indexOf(endMarker, start) : appSource.length;
    if (end === -1) {
        throw new Error(`Could not find end marker: ${endMarker}`);
    }
    return appSource.slice(start, end);
}

// eslint-disable-next-line no-eval
eval([
    extractFunctionRange('function resolveControlVisibilityState(', 'function shouldAutoOpenOnboardingGuide('),
    extractFunctionRange('function shouldAutoOpenOnboardingGuide(', 'function setElementHiddenState(')
].join('\n'));

const mobileVisibility = resolveControlVisibilityState({
    isMobileLayout: true,
    advancedControls: true,
    hasPOIs: true,
    hasRegions: true,
    hasRoads: true,
    hasRoutes: true,
    hasValidScale: true,
    hasBlurb: true,
    hasLatLonBounds: true,
    allowGMToolkit: true,
    atlasSearchCount: 10,
    routeCount: 2,
    toolkitVisible: true,
    gmVisible: true
});

assert.equal(mobileVisibility.showSearchTrigger, true);
assert.equal(mobileVisibility.showMarkersButton, false);
assert.equal(mobileVisibility.showMobileMarkersAction, true);
assert.equal(mobileVisibility.showFiltersButton, false);
assert.equal(mobileVisibility.showSearchFilterAction, true);
assert.equal(mobileVisibility.showRoutePanel, false);
assert.equal(mobileVisibility.showToolkitPanel, false);
assert.equal(mobileVisibility.showGMPill, false);
assert.equal(mobileVisibility.showMobileShareAction, true);
assert.equal(mobileVisibility.showMobileMapBlurb, true);

const desktopVisibility = resolveControlVisibilityState({
    isMobileLayout: false,
    advancedControls: true,
    hasPOIs: true,
    hasRegions: true,
    hasRoads: true,
    hasRoutes: true,
    hasValidScale: true,
    hasBlurb: true,
    hasLatLonBounds: true,
    allowGMToolkit: true,
    atlasSearchCount: 10,
    routeCount: 2,
    toolkitVisible: true,
    gmVisible: true
});

assert.equal(desktopVisibility.showSearchTrigger, false);
assert.equal(desktopVisibility.showMarkersButton, true);
assert.equal(desktopVisibility.showFiltersButton, true);
assert.equal(desktopVisibility.showRoutePanel, true);
assert.equal(desktopVisibility.showToolkitPanel, true);
assert.equal(desktopVisibility.showGMPill, true);
assert.equal(desktopVisibility.showMobileMapBlurb, false);

const embeddedVisibility = resolveControlVisibilityState({
    isEmbedded: true,
    isMobileLayout: true,
    advancedControls: true,
    hasPOIs: true,
    hasRegions: true,
    hasValidScale: true,
    hasBlurb: true,
    hasLatLonBounds: true,
    allowGMToolkit: true,
    atlasSearchCount: 5,
    routeCount: 1,
    toolkitVisible: true,
    gmVisible: true
});

assert.equal(embeddedVisibility.showMobileSidebarMeta, false);
assert.equal(embeddedVisibility.showMobileSidebarActions, false);
assert.equal(embeddedVisibility.showMobileSidebarLinks, false);
assert.equal(embeddedVisibility.showMobileShareAction, false);
assert.equal(embeddedVisibility.showMobileMapBlurb, false);

assert.equal(shouldAutoOpenOnboardingGuide({ isMobileLayout: true, hasSeenOnboarding: false }), false);
assert.equal(shouldAutoOpenOnboardingGuide({ isMobileLayout: false, hasSeenOnboarding: false }), true);
assert.equal(shouldAutoOpenOnboardingGuide({ isEmbedded: true, hasSeenOnboarding: false }), false);
assert.equal(shouldAutoOpenOnboardingGuide({ isMobileLayout: false, hasSeenOnboarding: true }), false);

console.log('mobile control visibility checks passed');
