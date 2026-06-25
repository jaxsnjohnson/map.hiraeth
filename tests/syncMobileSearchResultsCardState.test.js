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
    extractFunctionSource('isMobileSurfaceMode'),
    extractFunctionSource('syncMobileSearchResultsCardState')
].join('\n');

global.MOBILE_SURFACE_MODE_SEARCH = 'search';
global.MOBILE_SURFACE_MODE_ATLAS = 'atlas';
global.isMobileLayoutActive = true;
global.mobileSurfaceMode = global.MOBILE_SURFACE_MODE_SEARCH;
global.searchResultsContainer = null;
global.mobileSearchResultsCard = null;

// eslint-disable-next-line no-eval
eval(snippets);

function makeResultsContainer({ display = 'block', html = '<button>Found place</button>' } = {}) {
    return {
        style: { display },
        innerHTML: html
    };
}

function resetState() {
    global.isMobileLayoutActive = true;
    global.mobileSurfaceMode = global.MOBILE_SURFACE_MODE_SEARCH;
    global.searchResultsContainer = makeResultsContainer();
    global.mobileSearchResultsCard = { hidden: true };
}

resetState();
syncMobileSearchResultsCardState();
assert.equal(
    global.mobileSearchResultsCard.hidden,
    false,
    'card should be shown when mobile search has visible results'
);

resetState();
global.isMobileLayoutActive = false;
syncMobileSearchResultsCardState();
assert.equal(
    global.mobileSearchResultsCard.hidden,
    true,
    'card should be hidden outside mobile layout'
);

resetState();
global.mobileSurfaceMode = global.MOBILE_SURFACE_MODE_ATLAS;
syncMobileSearchResultsCardState();
assert.equal(
    global.mobileSearchResultsCard.hidden,
    true,
    'card should be hidden outside the mobile search surface'
);

resetState();
global.searchResultsContainer = makeResultsContainer({ display: 'none' });
syncMobileSearchResultsCardState();
assert.equal(
    global.mobileSearchResultsCard.hidden,
    true,
    'card should be hidden when the results container is hidden'
);

resetState();
global.searchResultsContainer = makeResultsContainer({ html: '   \n\t  ' });
syncMobileSearchResultsCardState();
assert.equal(
    global.mobileSearchResultsCard.hidden,
    true,
    'card should be hidden when there are no rendered results'
);

resetState();
global.searchResultsContainer = null;
syncMobileSearchResultsCardState();
assert.equal(
    global.mobileSearchResultsCard.hidden,
    true,
    'card should be hidden when the results container is missing'
);

resetState();
global.mobileSearchResultsCard = null;
assert.doesNotThrow(
    () => syncMobileSearchResultsCardState(),
    'missing mobile search results card should be a no-op'
);

console.log('syncMobileSearchResultsCardState checks passed');
