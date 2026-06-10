const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const helperStart = appSource.indexOf('function sanitizeWikiLinkForHref(value) {');
const nextHelperStart = appSource.indexOf('function resolveLinkedMapData(featureData) {');

if (helperStart === -1 || nextHelperStart === -1 || nextHelperStart <= helperStart) {
    throw new Error('Could not locate sanitizeWikiLinkForHref in js/app.js');
}

const helperSource = appSource.slice(helperStart, nextHelperStart);

let sanitizeWikiLinkForHref;
// eslint-disable-next-line no-eval
eval(`sanitizeWikiLinkForHref = ${helperSource}`);

describe('sanitizeWikiLinkForHref', () => {
    it('returns null for empty, falsy, and whitespace inputs', () => {
        assert.equal(sanitizeWikiLinkForHref(''), null);
        assert.equal(sanitizeWikiLinkForHref('   '), null);
        assert.equal(sanitizeWikiLinkForHref(null), null);
        assert.equal(sanitizeWikiLinkForHref(undefined), null);
    });

    it('returns null for inputs with control characters', () => {
        assert.equal(sanitizeWikiLinkForHref('http://example.com/\u0000'), null);
        assert.equal(sanitizeWikiLinkForHref('http://example.com/\u001F'), null);
        assert.equal(sanitizeWikiLinkForHref('http://example.com/\u007F'), null);
    });

    it('returns null for protocol-relative URLs', () => {
        assert.equal(sanitizeWikiLinkForHref('//example.com'), null);
        assert.equal(sanitizeWikiLinkForHref('//example.com/path'), null);
    });

    it('returns null for malformed local links', () => {
        assert.equal(sanitizeWikiLinkForHref('/path/with"quotes'), null);
        assert.equal(sanitizeWikiLinkForHref('/path/with\'quotes'), null);
        assert.equal(sanitizeWikiLinkForHref('/path/with<tags>'), null);
        assert.equal(sanitizeWikiLinkForHref('/path/with`ticks'), null);
        assert.equal(sanitizeWikiLinkForHref('/path/with spaces'), null);
    });

    it('returns raw value for valid local links', () => {
        assert.equal(sanitizeWikiLinkForHref('#anchor'), '#anchor');
        assert.equal(sanitizeWikiLinkForHref('/local/path'), '/local/path');
        assert.equal(sanitizeWikiLinkForHref('./relative/path'), './relative/path');
        assert.equal(sanitizeWikiLinkForHref('../up/path'), '../up/path');
    });

    it('returns parsed href for valid HTTP/HTTPS URLs', () => {
        assert.equal(sanitizeWikiLinkForHref('http://example.com'), 'http://example.com/');
        assert.equal(sanitizeWikiLinkForHref('https://example.com/path'), 'https://example.com/path');
        assert.equal(sanitizeWikiLinkForHref('HTTP://EXAMPLE.COM'), 'http://example.com/');
    });

    it('returns null for invalid or unsupported URL protocols', () => {
        assert.equal(sanitizeWikiLinkForHref('javascript:alert(1)'), null);
        assert.equal(sanitizeWikiLinkForHref('data:text/html,<script>alert(1)</script>'), null);
        assert.equal(sanitizeWikiLinkForHref('ftp://example.com'), null);
        assert.equal(sanitizeWikiLinkForHref('mailto:test@example.com'), null);
        assert.equal(sanitizeWikiLinkForHref('not-a-url'), null);
    });
});
