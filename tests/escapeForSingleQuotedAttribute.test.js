const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const fnStart = appSource.indexOf('function escapeForSingleQuotedAttribute(value) {');
const fnEnd = appSource.indexOf('function sanitizeWikiLinkForHref(value) {');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate escapeForSingleQuotedAttribute function in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

(() => {
    // Evaluate the real function source to keep the test tightly coupled to production code.
    // eslint-disable-next-line no-eval
    eval(fnSource);

    // Test empty input
    assert.equal(escapeForSingleQuotedAttribute(), '');
    assert.equal(escapeForSingleQuotedAttribute(null), '');
    assert.equal(escapeForSingleQuotedAttribute(''), '');

    // Test string with no special characters
    assert.equal(escapeForSingleQuotedAttribute('hello world'), 'hello world');
    assert.equal(escapeForSingleQuotedAttribute('123abc'), '123abc');

    // Test special characters individually
    assert.equal(escapeForSingleQuotedAttribute('&'), '&amp;');
    assert.equal(escapeForSingleQuotedAttribute('<'), '&lt;');
    assert.equal(escapeForSingleQuotedAttribute('>'), '&gt;');
    assert.equal(escapeForSingleQuotedAttribute('"'), '&quot;');
    assert.equal(escapeForSingleQuotedAttribute('\\'), '\\\\');
    assert.equal(escapeForSingleQuotedAttribute("'"), "&#39;");

    // Test combinations
    assert.equal(escapeForSingleQuotedAttribute('<div class="test" onclick=\'alert("hello")\'>&</div>'), '&lt;div class=&quot;test&quot; onclick=&#39;alert(&quot;hello&quot;)&#39;&gt;&amp;&lt;/div&gt;');
    assert.equal(escapeForSingleQuotedAttribute('a & b < c > d "e" \\ f \'g\''), 'a &amp; b &lt; c &gt; d &quot;e&quot; \\\\ f &#39;g&#39;');

    console.log('escapeForSingleQuotedAttribute regression checks passed');
})();
