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
global.map = {};
global.miniMapControl = null;

// eslint-disable-next-line no-eval
eval(snippets);

assert.equal(shouldShowMiniMap(), false);
syncMiniMapControl();
assert.equal(global.miniMapControl, null);
assert.equal(global.createdControls, 0);

global.isMobileLayoutActive = false;
assert.equal(shouldShowMiniMap(), true);
syncMiniMapControl();
assert.ok(global.miniMapControl);
assert.equal(global.createdControls, 1);
assert.equal(global.miniMapControl.options.width, 200);

const createdControl = global.miniMapControl;
global.isMobileLayoutActive = true;
syncMiniMapControl();
assert.equal(createdControl.removed, true);
assert.equal(global.miniMapControl, null);

global.isMobileLayoutActive = false;
syncMiniMapControl();
assert.ok(global.miniMapControl);
assert.equal(global.createdControls, 2);

global.isEmbeddedView = true;
syncMiniMapControl();
assert.equal(global.miniMapControl, null);

console.log('mobile minimap visibility checks passed');
