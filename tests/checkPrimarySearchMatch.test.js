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
    extractFunctionSource('checkPrimarySearchMatch')
].join('\n');

// eslint-disable-next-line no-eval
eval(snippets);

// exact match
assert.deepEqual(checkPrimarySearchMatch('apple', 'apple'), { matched: true, score: 520, matchedByContent: false });

// starts with
assert.deepEqual(checkPrimarySearchMatch('app', 'apple'), { matched: true, score: 430, matchedByContent: false });

// substring
assert.deepEqual(checkPrimarySearchMatch('ppl', 'apple'), { matched: true, score: 319, matchedByContent: false });
assert.deepEqual(checkPrimarySearchMatch('ple', 'apple'), { matched: true, score: 318, matchedByContent: false });

// substring with cap score reduction
const longString = 'a'.repeat(150) + 'pple';
assert.deepEqual(checkPrimarySearchMatch('pple', longString), { matched: true, score: 200, matchedByContent: false });

console.log('checkPrimarySearchMatch tests passed');
