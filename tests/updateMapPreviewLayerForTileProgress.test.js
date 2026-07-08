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

const performanceValues = new Map();
function getPerformanceNumber(name, fallbackValue) {
    return performanceValues.has(name) ? performanceValues.get(name) : fallbackValue;
}

let currentMapPreviewLayer = null;

// eslint-disable-next-line no-eval
eval([
    extractFunctionSource('getTilePreviewFadeConfig'),
    extractFunctionSource('getMapPreviewLayerElement'),
    extractFunctionSource('setMapPreviewLayerOpacity'),
    extractFunctionSource('updateMapPreviewLayerForTileProgress')
].join('\n'));

function createPreviewLayer() {
    const element = { style: {} };
    const opacityValues = [];
    currentMapPreviewLayer = {
        setOpacity(value) {
            opacityValues.push(value);
        },
        getElement() {
            return element;
        }
    };
    return { element, opacityValues };
}

performanceValues.set('tilePreviewFadeStartRatio', 0.45);
performanceValues.set('tilePreviewRetireRatio', 0.76);

let preview = createPreviewLayer();
updateMapPreviewLayerForTileProgress({ total: 10, loaded: 4, failed: 0 });
assert.equal(preview.opacityValues.at(-1), 1);
assert.equal(preview.element.style.opacity, '1');

preview = createPreviewLayer();
updateMapPreviewLayerForTileProgress({ total: 10, loaded: 6, failed: 0 });
assert.ok(preview.opacityValues.at(-1) < 1);
assert.ok(preview.opacityValues.at(-1) > 0);

preview = createPreviewLayer();
updateMapPreviewLayerForTileProgress({ total: 10, loaded: 8, failed: 0 });
assert.equal(preview.opacityValues.at(-1), 0);
assert.equal(preview.element.style.opacity, '0');

preview = createPreviewLayer();
updateMapPreviewLayerForTileProgress({ total: 10, loaded: 8, failed: 1 });
assert.equal(preview.opacityValues.at(-1), 1);
assert.equal(preview.element.style.opacity, '1');

preview = createPreviewLayer();
setMapPreviewLayerOpacity('not-a-number');
assert.equal(preview.opacityValues.at(-1), 1);
assert.equal(preview.element.style.opacity, '1');

currentMapPreviewLayer = null;
assert.doesNotThrow(() => {
    updateMapPreviewLayerForTileProgress({ total: 10, loaded: 8, failed: 0 });
});

console.log('updateMapPreviewLayerForTileProgress checks passed');
