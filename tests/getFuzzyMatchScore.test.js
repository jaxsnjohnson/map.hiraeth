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
    extractFunctionSource('getFuzzyMatchScore')
].join('\n');

// eslint-disable-next-line no-eval
eval(snippets);

// Missing input conditions
assert.equal(getFuzzyMatchScore('', 'target'), -1, 'Should return -1 for empty term');
assert.equal(getFuzzyMatchScore('term', ''), -1, 'Should return -1 for empty target');
assert.equal(getFuzzyMatchScore(undefined, 'target'), -1, 'Should return -1 for undefined term');
assert.equal(getFuzzyMatchScore('term', undefined), -1, 'Should return -1 for undefined target');
assert.equal(getFuzzyMatchScore('', ''), -1, 'Should return -1 for empty term and target');

// No match conditions
assert.equal(getFuzzyMatchScore('z', 'target'), -1, 'Should return -1 when character is missing');
assert.equal(getFuzzyMatchScore('xa', 'xyz'), -1, 'Should return -1 when string is not fully found');

// Consecutive matches
// term: 'abc', target: 'abc'
// char 'a': found=0, lastMatchIndex=-1 -> last=0, search=1
// char 'b': found=1, lastMatchIndex=0 -> penalty=max(0, 1-0-1)=0 -> last=1, search=2
// char 'c': found=2, lastMatchIndex=1 -> penalty=max(0, 2-1-1)=0 -> last=2, search=3
// score = max(40, 160-0) = 160
assert.equal(getFuzzyMatchScore('abc', 'abc'), 160, 'Should return 160 for exact match without spread penalty');
assert.equal(getFuzzyMatchScore('ab', 'abc'), 160, 'Should return 160 for prefix match without spread penalty');

// Spread-out matches
// term: 'ac', target: 'abc'
// char 'a': found=0, lastMatchIndex=-1 -> last=0, search=1
// char 'c': found=2, lastMatchIndex=0 -> penalty=max(0, 2-0-1)=1 -> last=2, search=3
// score = max(40, 160-1) = 159
assert.equal(getFuzzyMatchScore('ac', 'abc'), 159, 'Should penalize score based on spread distance');

// term: 'ace', target: 'abcde'
// char 'a': found=0, lastMatchIndex=-1
// char 'c': found=2, lastMatchIndex=0 -> penalty += max(0, 2-0-1)=1 -> penalty=1
// char 'e': found=4, lastMatchIndex=2 -> penalty += max(0, 4-2-1)=1 -> penalty=2
// score = max(40, 160-2) = 158
assert.equal(getFuzzyMatchScore('ace', 'abcde'), 158, 'Should accumulate spread penalties');

// Max spread penalty behaviors (minimum score is 40)
// spread penalty >= 120 should hit the floor of 40
// let's construct a string with spread 150
// char 'a' at 0, char 'b' at 151
const largeTarget = 'a' + 'x'.repeat(150) + 'b';
// found 'a' at 0, found 'b' at 151. penalty = max(0, 151-0-1) = 150
// score = max(40, 160-150) = max(40, 10) = 40
assert.equal(getFuzzyMatchScore('ab', largeTarget), 40, 'Should return minimum score of 40 for very large spreads');

console.log('getFuzzyMatchScore tests passed');
