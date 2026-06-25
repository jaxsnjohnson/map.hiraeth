const { afterEach, beforeEach, describe, it } = require('node:test');
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

// eslint-disable-next-line no-eval
eval(extractFunctionSource('shouldShowMiniMap'));

function useMiniMapFeatureFlag(value) {
    const calls = [];
    global.getFeatureFlag = (name, fallbackValue) => {
        calls.push([name, fallbackValue]);
        return value;
    };
    return calls;
}

describe('shouldShowMiniMap', () => {
    beforeEach(() => {
        global.isEmbeddedView = false;
    });

    afterEach(() => {
        delete global.getFeatureFlag;
        delete global.isEmbeddedView;
    });

    it('shows the minimap when the feature flag is enabled outside embedded view', () => {
        const calls = useMiniMapFeatureFlag(true);

        assert.equal(shouldShowMiniMap(), true);
        assert.deepEqual(calls, [['minimap', true]]);
    });

    it('hides the minimap when the feature flag is disabled', () => {
        useMiniMapFeatureFlag(false);

        assert.equal(shouldShowMiniMap(), false);
    });

    it('hides the minimap in embedded view even when the feature flag is enabled', () => {
        useMiniMapFeatureFlag(true);
        global.isEmbeddedView = true;

        assert.equal(shouldShowMiniMap(), false);
    });

    it('defaults to enabled when the feature flag helper is unavailable', () => {
        delete global.getFeatureFlag;

        assert.equal(shouldShowMiniMap(), true);

        global.isEmbeddedView = true;
        assert.equal(shouldShowMiniMap(), false);
    });
});
