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

let tileBacked = false;
let prefetchedUrls = [];

function getMapTileSource() {
    return tileBacked ? { type: 'xyz' } : null;
}

function getPreferredMapImageUrl(mapInfo) {
    return mapInfo.imageUrl;
}

function prefetchImageAsset(url) {
    prefetchedUrls.push(url);
}

let prefetchMapImageAsset;
// eslint-disable-next-line no-eval
eval(`prefetchMapImageAsset = ${extractFunctionSource('prefetchMapImageAsset')}`);

prefetchMapImageAsset({ imageUrl: 'maps/Fair-Content.webp' });
assert.deepEqual(prefetchedUrls, ['maps/Fair-Content.webp']);

tileBacked = true;
prefetchMapImageAsset({ imageUrl: 'maps/Fair-Content.webp' });
assert.deepEqual(prefetchedUrls, ['maps/Fair-Content.webp']);

prefetchMapImageAsset(null);
assert.deepEqual(prefetchedUrls, ['maps/Fair-Content.webp']);

console.log('prefetchMapImageAsset checks passed');
