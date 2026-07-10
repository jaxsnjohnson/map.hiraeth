const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert.match(
    appSource,
    /const focusTarget = isMobileLayoutActive \? mobileSheetLauncherBtn : sidebarBackToChooserBtn;/,
    'closing the gallery should restore focus to a visible mobile launcher on small screens'
);

function extractFunctionSource(name) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) throw new Error(`Could not find function ${name}`);
    const signatureEnd = appSource.indexOf(') {', start);
    if (signatureEnd === -1) throw new Error(`Could not find body for function ${name}`);
    let depth = 1;
    for (let index = signatureEnd + 3; index < appSource.length; index += 1) {
        if (appSource[index] === '{') depth += 1;
        if (appSource[index] === '}') {
            depth -= 1;
            if (depth === 0) return appSource.slice(start, index + 1);
        }
    }
    throw new Error(`Could not parse function ${name}`);
}

let mapChooserElement = { hidden: false };
let restoreMapChooserTriggerOnPopState = false;
let currentlyLoadedMapId = 'main_continent';
let currentSidebarState = 'open';
let mapData = [];
let history = {
    state: { mapChooserOverlay: true },
    backCalls: 0,
    back() { this.backCalls += 1; }
};
let window = { location: { search: '?gallery=true' } };
let UX_STORAGE_KEYS = { lastMapId: 'lastMapId' };
let safeGetStorage = () => '';
let findFirstLoadableIdRecursive = () => 'main_continent';
let clearTransientMapSearchParams = () => '';
let generateHash = (mapId) => `#${mapId}`;
let buildAppUrlWithHash = (hash, search) => `${search}${hash}`;
let setMapChooserVisibleCalls = [];
let setMapChooserVisible = (visible) => setMapChooserVisibleCalls.push(visible);
let loadMapCalls = [];
let loadMap = (...args) => loadMapCalls.push(args);
let focusCalls = 0;
let mapElement = { focus() { focusCalls += 1; } };
let requestAnimationFrame = (callback) => callback();

let closeMapChooserToMap;
// eslint-disable-next-line no-eval
eval(`closeMapChooserToMap = ${extractFunctionSource('closeMapChooserToMap')}`);

closeMapChooserToMap();
assert.equal(history.backCalls, 1);
assert.equal(restoreMapChooserTriggerOnPopState, true);
assert.deepEqual(setMapChooserVisibleCalls, []);

history = {
    state: null,
    replacement: null,
    replaceState(state, title, url) { this.replacement = { state, title, url }; }
};
currentlyLoadedMapId = '';
restoreMapChooserTriggerOnPopState = false;
setMapChooserVisibleCalls = [];
loadMapCalls = [];

closeMapChooserToMap();
assert.equal(history.replacement.state.mapId, 'main_continent');
assert.equal(history.replacement.url, '#main_continent');
assert.deepEqual(setMapChooserVisibleCalls, [false]);
assert.deepEqual(loadMapCalls, [['main_continent', false]]);
assert.equal(focusCalls, 1);

mapChooserElement.hidden = true;
closeMapChooserToMap();
assert.deepEqual(loadMapCalls, [['main_continent', false]]);

let isRenderableMapEntry = () => true;
let isMobileLayoutActive = false;
let unlockAdvancedControlsCalls = [];
let unlockAdvancedControls = (...args) => unlockAdvancedControlsCalls.push(args);
let analyticsCalls = [];
let trackAnalytics = (...args) => analyticsCalls.push(args);
let navigationCalls = [];
let navigateToMap = (...args) => navigationCalls.push(args);
let openMapFromChooser;
eval(`openMapFromChooser = ${extractFunctionSource('openMapFromChooser')}`);

mapChooserElement.hidden = false;
setMapChooserVisibleCalls = [];
const selectedMap = { id: 'IceBeach', name: 'IceBeach' };
openMapFromChooser(selectedMap);
assert.deepEqual(setMapChooserVisibleCalls, [false]);
assert.deepEqual(unlockAdvancedControlsCalls, [['map_chooser_selected']]);
assert.deepEqual(analyticsCalls, [['map_chooser_selected', { mapId: 'IceBeach', mapName: 'IceBeach' }]]);
assert.deepEqual(navigationCalls, [['IceBeach', { preResolvedMap: selectedMap }]]);
assert.equal(focusCalls, 2, 'selecting a gallery card should move focus back to the map');

console.log('map chooser close behavior checks passed');
