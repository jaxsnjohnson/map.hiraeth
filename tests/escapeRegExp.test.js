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

const snippets = extractFunctionSource('escapeRegExp');

// eslint-disable-next-line no-eval
eval(snippets);

// Test empty string
assert.equal(escapeRegExp(''), '');

// Test string with no special characters
assert.equal(escapeRegExp('hello world'), 'hello world');
assert.equal(escapeRegExp('123abc'), '123abc');

// Test special characters individually
assert.equal(escapeRegExp('.'), '\\.');
assert.equal(escapeRegExp('*'), '\\*');
assert.equal(escapeRegExp('+'), '\\+');
assert.equal(escapeRegExp('?'), '\\?');
assert.equal(escapeRegExp('^'), '\\^');
assert.equal(escapeRegExp('$'), '\\$');
assert.equal(escapeRegExp('{'), '\\{');
assert.equal(escapeRegExp('}'), '\\}');
assert.equal(escapeRegExp('('), '\\(');
assert.equal(escapeRegExp(')'), '\\)');
assert.equal(escapeRegExp('|'), '\\|');
assert.equal(escapeRegExp('['), '\\[');
assert.equal(escapeRegExp(']'), '\\]');
assert.equal(escapeRegExp('\\'), '\\\\');

// Test combinations
assert.equal(escapeRegExp('^hello$'), '\\^hello\\$');
assert.equal(escapeRegExp('user(name)'), 'user\\(name\\)');
assert.equal(escapeRegExp('.*+?'), '\\.\\*\\+\\?');

console.log('escapeRegExp regression checks passed');
