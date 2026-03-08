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
eval(extractFunctionSource('getPreferredMapImageUrl'));

global.mobileLayoutV2Enabled = false;
global.isMobileLayoutActive = false;
assert.equal(
    getPreferredMapImageUrl({ imageUrl: 'maps/default.webp', imageVariants: { mobile: 'maps/mobile.webp' } }),
    'maps/default.webp'
);

global.mobileLayoutV2Enabled = true;
global.isMobileLayoutActive = true;
assert.equal(
    getPreferredMapImageUrl({ imageUrl: 'maps/default.webp', imageVariants: { mobile: 'maps/mobile.webp' } }),
    'maps/mobile.webp'
);

assert.equal(
    getPreferredMapImageUrl({ imageUrl: 'maps/default.webp', smallImageUrl: 'maps/small.webp' }),
    'maps/small.webp'
);

assert.equal(
    getPreferredMapImageUrl({ imageVariants: { default: 'maps/base.webp', compact: 'maps/compact.webp' } }),
    'maps/compact.webp'
);

console.log('getPreferredMapImageUrl regression checks passed');
