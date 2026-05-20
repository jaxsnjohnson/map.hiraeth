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

    const snippets = extractFunctionSource('escapeHtml');

    // eslint-disable-next-line no-eval
    eval(snippets);

    // Test empty and falsy inputs
    assert.equal(escapeHtml(''), '');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');

    // Test string with no special characters
    assert.equal(escapeHtml('hello world'), 'hello world');
    assert.equal(escapeHtml('123abc'), '123abc');

    // Test special characters individually
    assert.equal(escapeHtml('&'), '&amp;');
    assert.equal(escapeHtml('<'), '&lt;');
    assert.equal(escapeHtml('>'), '&gt;');
    assert.equal(escapeHtml('"'), '&quot;');
    assert.equal(escapeHtml("'"), '&#39;');

    // Test combinations
    assert.equal(escapeHtml('<script>alert("XSS & hacks")</script>'), '&lt;script&gt;alert(&quot;XSS &amp; hacks&quot;)&lt;/script&gt;');
    assert.equal(escapeHtml('user\'s "data" & info < >'), 'user&#39;s &quot;data&quot; &amp; info &lt; &gt;');

    console.log('escapeHtml regression checks passed');
})();
