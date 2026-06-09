const assert = require('node:assert/strict');
const fs = require('node:fs');

(() => {
    const appSource = fs.readFileSync('js/app.js', 'utf8');

    function extractFunctionSource(name, nextName) {
        const start = appSource.indexOf(`function ${name}(`);
        if (start === -1) {
            throw new Error(`Could not find function ${name}`);
        }
        const end = appSource.indexOf(`function ${nextName}(`);
        if (end === -1) {
            throw new Error(`Could not find next function ${nextName}`);
        }
        return appSource.slice(start, end);
    }

    const snippets = extractFunctionSource('stripHtml', 'getMapRuntimeData');

    // eslint-disable-next-line no-eval
    eval(snippets);

    // Test empty and falsy inputs
    assert.equal(stripHtml(''), '');
    assert.equal(stripHtml(null), '');
    assert.equal(stripHtml(undefined), '');

    // Test string with no HTML
    assert.equal(stripHtml('hello world'), 'hello world');
    assert.equal(stripHtml('123abc'), '123abc');

    // Test basic HTML
    assert.equal(stripHtml('<p>test</p>'), 'test');
    assert.equal(stripHtml('<b>bold</b>'), 'bold');

    // Test HTML with attributes
    assert.equal(stripHtml('<a href="https://example.com">link</a>'), 'link');
    assert.equal(stripHtml('<div class="container" id="main">content</div>'), 'content');

    // Test nested and multiple tags
    assert.equal(stripHtml('<div><p>nested <span>content</span></p></div>'), 'nested content');
    assert.equal(stripHtml('<h1>heading</h1><p>paragraph</p>'), 'heading paragraph');

    // Test formatting/spacing handling
    assert.equal(stripHtml('<p>  spaces  </p>'), 'spaces');
    assert.equal(stripHtml('<div>line<br>break</div>'), 'line break');
    assert.equal(stripHtml('  <p> padded </p>  '), 'padded');
    assert.equal(stripHtml('<p>multiple   spaces</p>'), 'multiple spaces');

    console.log('stripHtml tests passed');
})();
