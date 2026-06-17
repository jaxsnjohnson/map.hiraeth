const assert = require('node:assert/strict');
const fs = require('node:fs');

(() => {
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

    const snippets = extractFunctionSource('normalizeSearchValue');

    // eslint-disable-next-line no-eval
    eval(snippets);

    // Test normal strings
    assert.equal(normalizeSearchValue('Hello World'), 'hello world');
    assert.equal(normalizeSearchValue('  TESTING  '), 'testing');
    assert.equal(normalizeSearchValue('lowercase'), 'lowercase');

    // Test falsy values
    assert.equal(normalizeSearchValue(''), '');
    assert.equal(normalizeSearchValue(null), '');
    assert.equal(normalizeSearchValue(undefined), '');
    assert.equal(normalizeSearchValue(0), '');
    assert.equal(normalizeSearchValue(false), '');

    // Test numbers and booleans
    // Note: Due to || '', truthy non-strings are converted to strings
    assert.equal(normalizeSearchValue(123), '123');
    assert.equal(normalizeSearchValue(true), 'true');

    // Test whitespace strings
    assert.equal(normalizeSearchValue('   '), '');
    assert.equal(normalizeSearchValue('\t\n'), '');

    console.log('normalizeSearchValue tests passed');
})();
