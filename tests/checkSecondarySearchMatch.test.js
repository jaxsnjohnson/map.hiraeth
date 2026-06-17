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
    extractFunctionSource('getFuzzyMatchScore'),
    extractFunctionSource('checkSecondarySearchMatch')
].join('\n');

// eslint-disable-next-line no-eval
eval(snippets);

// exact inclusion
const exactMatch = checkSecondarySearchMatch('cold', 'a cold harbor city');
assert.deepEqual(exactMatch, { matched: true, score: 180, matchedByContent: true });

// fuzzy match where spread is small
const fuzzyMatch = checkSecondarySearchMatch('cdh', 'a cold harbor city');
// c(2) -> d(5) = penalty 2. d(5) -> h(7) = penalty 1. Total penalty = 3. Score = 160 - 3 = 157.
// checkSecondarySearchMatch returns Math.max(80, 157 - 40) = 117
assert.deepEqual(fuzzyMatch, { matched: true, score: 117, matchedByContent: true });

// very spread fuzzy match to test minimum bounds
const longFuzzyMatch = checkSecondarySearchMatch('ac', 'a very very very very very very very very very very very very very very long cold harbor city');
// The minimum score returned by getFuzzyMatchScore is 40. checkSecondarySearchMatch returns Math.max(80, 40 - 40) = 80.
assert.deepEqual(longFuzzyMatch, { matched: true, score: 80, matchedByContent: true });

// no match
const noMatch = checkSecondarySearchMatch('zzz', 'a cold harbor city');
assert.equal(noMatch, null);

console.log('checkSecondarySearchMatch tests passed');
