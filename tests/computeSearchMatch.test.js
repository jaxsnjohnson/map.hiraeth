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
    extractFunctionSource('normalizeSearchValue'),
    extractFunctionSource('getFuzzyMatchScore'),
    extractFunctionSource('checkPrimarySearchMatch'),
    extractFunctionSource('checkSecondarySearchMatch'),
    extractFunctionSource('computeSearchMatch'),
    extractFunctionSource('computePrecomputedSearchMatch')
].join('\n');

// eslint-disable-next-line no-eval
eval(snippets);

const exact = computeSearchMatch('icebeach', 'Icebeach', '');
const prefix = computeSearchMatch('ice', 'Icebeach', '');
const fuzzy = computeSearchMatch('ibch', 'Icebeach', '');
const content = computeSearchMatch('harbor', 'Icebeach', 'A cold harbor city');

assert.equal(exact.matched, true);
assert.equal(prefix.matched, true);
assert.equal(fuzzy.matched, true);
assert.equal(content.matched, true);
assert.equal(content.matchedByContent, true);
assert.ok(exact.score > prefix.score);
assert.ok(prefix.score > fuzzy.score);
assert.ok(fuzzy.score > 0);
assert.ok(content.score > 0);
assert.equal(computeSearchMatch('zzz', 'Icebeach', '').matched, false);

const precomputedPrimary = normalizeSearchValue('Icebeach');
const precomputedSecondary = normalizeSearchValue('A cold harbor city');

assert.deepEqual(
    computePrecomputedSearchMatch('ice', precomputedPrimary, precomputedSecondary),
    computeSearchMatch('ice', 'Icebeach', 'A cold harbor city')
);
assert.deepEqual(
    computePrecomputedSearchMatch('harbor', precomputedPrimary, precomputedSecondary),
    computeSearchMatch('harbor', 'Icebeach', 'A cold harbor city')
);
assert.deepEqual(
    computePrecomputedSearchMatch('zzz', precomputedPrimary, precomputedSecondary),
    computeSearchMatch('zzz', 'Icebeach', 'A cold harbor city')
);

console.log('computeSearchMatch regression checks passed');
