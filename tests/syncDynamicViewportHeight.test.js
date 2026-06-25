const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const appSource = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');

function extractFunctionSource(name, endSignature) {
    const start = appSource.indexOf(`function ${name}() {`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }
    const end = appSource.indexOf(endSignature, start);
    if (end === -1) {
        throw new Error(`Could not parse function ${name}`);
    }
    return appSource.slice(start, end);
}

const functionSource = extractFunctionSource('syncDynamicViewportHeight', 'function syncBottomBarHeightVariable() {');

let syncDynamicViewportHeight;

describe('syncDynamicViewportHeight', () => {
    beforeEach(() => {
        global.window = {};
        global.rootElement = {
            style: {
                setProperty: (key, value) => {
                    global.rootElement.style._properties = global.rootElement.style._properties || {};
                    global.rootElement.style._properties[key] = value;
                },
                _properties: {}
            }
        };

        global.Math = Math;

        eval(`syncDynamicViewportHeight = ${functionSource}`);
    });

    afterEach(() => {
        delete global.window;
        delete global.rootElement;
    });

    it('should use window.visualViewport.height if available', () => {
        global.window.visualViewport = { height: 800.75 };
        global.window.innerHeight = 900;

        syncDynamicViewportHeight();

        assert.equal(global.rootElement.style._properties['--app-height'], '801px');
    });

    it('should fall back to window.innerHeight if visualViewport is missing', () => {
        global.window.visualViewport = undefined;
        global.window.innerHeight = 900.25;

        syncDynamicViewportHeight();

        assert.equal(global.rootElement.style._properties['--app-height'], '900px');
    });
});
