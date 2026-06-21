const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionSource(name) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < appSource.length; i += 1) {
        const char = appSource[i];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }
    if (end === -1) {
        throw new Error(`Could not parse function ${name}`);
    }
    return appSource.slice(start, end);
}

const snippets = [
    extractFunctionSource('getPreferredMapImageUrl'),
    extractFunctionSource('getMiniMapImageUrl'),
    extractFunctionSource('shouldShowMiniMap'),
    extractFunctionSource('removeMiniMapControl'),
    extractFunctionSource('syncMiniMapControl')
].join('\n');

global.isEmbeddedView = false;
global.isMobileLayoutActive = true;
global.mobileLayoutV2Enabled = true;
global.currentBounds = [[0, 0], [1200, 2400]];
global.currentMapData = {
    width: 2400,
    height: 1200,
    imageUrl: 'maps/default.webp'
};
global.createdControls = 0;
global.L = {
    CRS: {
        Simple: {}
    },
    imageOverlay(url, bounds) {
        return { url, bounds };
    },
    latLngBounds(bounds) {
        return {
            getCenter() {
                return { bounds };
            }
        };
    },
    Control: {
        MiniMap: class MiniMap {
            constructor(layer, options) {
                this.layer = layer;
                this.options = options;
                global.createdControls += 1;
            }

            addTo(map) {
                this.map = map;
                return this;
            }

            remove() {
                this.removed = true;
            }
        }
    }
};
global.pendingMiniMapReady = null;
global.map = {
    _loaded: false,
    whenReady(callback) {
        global.pendingMiniMapReady = callback;
    }
};
global.miniMapControl = null;
global.miniMapControlMode = null;

// eslint-disable-next-line no-eval
eval(snippets);

assert.equal(getMiniMapImageUrl({ imageUrl: 'maps/default.webp' }), 'maps/default.mini.webp');
assert.equal(getMiniMapImageUrl({ imageUrl: 'maps/Old-Lin Map.jpeg' }), 'maps/Old-Lin Map.mini.webp');
assert.equal(getMiniMapImageUrl({ imageUrl: 'maps/default.webp?asset=1#view' }), 'maps/default.mini.webp?asset=1#view');
assert.equal(getMiniMapImageUrl({ imageUrl: '' }), '');

assert.equal(shouldShowMiniMap(), true);
syncMiniMapControl();
assert.equal(global.miniMapControl, null);
assert.equal(global.createdControls, 0);
assert.equal(typeof global.pendingMiniMapReady, 'function');

global.map._loaded = true;
global.pendingMiniMapReady();
assert.ok(global.miniMapControl);
assert.equal(global.createdControls, 1);
assert.equal(global.miniMapControl.layer.url, 'maps/default.mini.webp');
assert.equal(global.miniMapControl.options.width, 132);

global.isMobileLayoutActive = false;
assert.equal(shouldShowMiniMap(), true);
syncMiniMapControl();
assert.ok(global.miniMapControl);
assert.equal(global.createdControls, 2);
assert.equal(global.miniMapControl.options.width, 200);

const createdControl = global.miniMapControl;
global.isMobileLayoutActive = true;
syncMiniMapControl();
assert.equal(createdControl.removed, true);
assert.ok(global.miniMapControl);
assert.equal(global.createdControls, 3);
assert.equal(global.miniMapControl.options.width, 132);

global.isMobileLayoutActive = false;
syncMiniMapControl();
assert.ok(global.miniMapControl);
assert.equal(global.createdControls, 4);

global.isEmbeddedView = true;
syncMiniMapControl();
assert.equal(global.miniMapControl, null);

console.log('mobile minimap visibility checks passed');
