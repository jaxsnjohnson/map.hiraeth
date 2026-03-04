const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const buildUrlStart = appSource.indexOf('function buildFeatureShareUrl(type, name) {');
const buildUrlEnd = appSource.indexOf('function canUseNativeShare(shareUrl) {');
const shareTrackingStart = appSource.indexOf('const sharedLinkOpenSessionKeys = new Set();');
const shareTrackingEnd = appSource.indexOf('function buildFeatureShareUrl(type, name) {');

if (
    buildUrlStart === -1 ||
    buildUrlEnd === -1 ||
    shareTrackingStart === -1 ||
    shareTrackingEnd === -1
) {
    throw new Error('Could not locate Smart Share helpers in js/app.js');
}

const buildUrlSource = appSource.slice(buildUrlStart, buildUrlEnd);
const shareTrackingSource = appSource.slice(shareTrackingStart, shareTrackingEnd);

global.window = {
    location: {
        href: 'https://maps.hiraeth.wiki/?view=12.01,30.4,2&route=north-road&poi=Old%20Dock#line-map-s=o'
    }
};
global.map = {
    getCenter() {
        return { lat: 18.123456, lng: -27.654321 };
    },
    getZoom() {
        return 3;
    }
};
global.currentlyLoadedMapId = 'icebeach';

// eslint-disable-next-line no-eval
eval(buildUrlSource);

const sharedRegionUrl = buildFeatureShareUrl('region', 'Starfall Bay');
const parsedShareUrl = new URL(sharedRegionUrl);

assert.equal(parsedShareUrl.searchParams.get('region'), 'Starfall Bay');
assert.equal(parsedShareUrl.searchParams.get('poi'), null);
assert.equal(parsedShareUrl.searchParams.get('line'), null);
assert.equal(parsedShareUrl.searchParams.get('route'), 'north-road');
assert.equal(parsedShareUrl.searchParams.get('view'), '12.01,30.4,2');
assert.equal(parsedShareUrl.searchParams.get('src'), 'share');
assert.equal(parsedShareUrl.searchParams.get('stype'), 'region');
assert.equal(parsedShareUrl.hash, '#line-map-s=o');

assert.equal(buildFeatureShareUrl('invalid-type', 'Name'), null);
assert.equal(buildFeatureShareUrl('poi', ''), null);

const sharedViewUrl = buildCurrentViewShareUrl();
const parsedViewShareUrl = new URL(sharedViewUrl);
assert.equal(parsedViewShareUrl.searchParams.get('view'), '18.1235,-27.6543,3');
assert.equal(parsedViewShareUrl.searchParams.get('poi'), null);
assert.equal(parsedViewShareUrl.searchParams.get('region'), null);
assert.equal(parsedViewShareUrl.searchParams.get('line'), null);
assert.equal(parsedViewShareUrl.searchParams.get('src'), 'share');
assert.equal(parsedViewShareUrl.searchParams.get('stype'), 'view');
assert.equal(parsedViewShareUrl.hash, '#line-map-s=o');

const trackedEvents = [];
function trackAnalytics(eventName, details) {
    trackedEvents.push({ eventName, details });
}

// eslint-disable-next-line no-eval
eval(shareTrackingSource);

const firstParams = new URLSearchParams('poi=Old Dock&src=share&stype=poi');
trackShareLinkOpenFromParams(firstParams, 'poi', 'Old Dock');
assert.equal(trackedEvents.length, 1);
assert.equal(trackedEvents[0].eventName, 'share_link_opened');
assert.equal(trackedEvents[0].details.source, 'share');
assert.equal(trackedEvents[0].details.sharedType, 'poi');
assert.equal(trackedEvents[0].details.featureName, 'Old Dock');

// Should be tracked once per session per feature.
trackShareLinkOpenFromParams(firstParams, 'poi', 'Old Dock');
assert.equal(trackedEvents.length, 1);

// Ignore non-share sources.
const nonShareParams = new URLSearchParams('poi=Old Dock&src=external&stype=poi');
trackShareLinkOpenFromParams(nonShareParams, 'poi', 'Old Dock');
assert.equal(trackedEvents.length, 1);

// Ignore attribution type mismatch.
const mismatchParams = new URLSearchParams('line=North Road&src=share&stype=line');
trackShareLinkOpenFromParams(mismatchParams, 'poi', 'Old Dock');
assert.equal(trackedEvents.length, 1);

// Different shared feature should still track.
trackShareLinkOpenFromParams(mismatchParams, 'line', 'North Road');
assert.equal(trackedEvents.length, 2);
assert.equal(trackedEvents[1].details.sharedType, 'line');
assert.equal(trackedEvents[1].details.featureName, 'North Road');

const sharedViewParams = new URLSearchParams('view=18.1235,-27.6543,3&src=share&stype=view');
trackShareViewOpenFromParams(sharedViewParams, '18.1235,-27.6543,3');
assert.equal(trackedEvents.length, 3);
assert.equal(trackedEvents[2].details.sharedType, 'view');
assert.equal(trackedEvents[2].details.featureName, 'current_view');

// Should be tracked once per session per shared view.
trackShareViewOpenFromParams(sharedViewParams, '18.1235,-27.6543,3');
assert.equal(trackedEvents.length, 3);

// Ignore non-share sources for view links.
const nonShareViewParams = new URLSearchParams('view=18.1235,-27.6543,3&src=external&stype=view');
trackShareViewOpenFromParams(nonShareViewParams, '18.1235,-27.6543,3');
assert.equal(trackedEvents.length, 3);

console.log('share link flow regression checks passed');
