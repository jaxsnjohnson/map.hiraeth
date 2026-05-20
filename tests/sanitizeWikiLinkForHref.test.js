import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';

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
        expect(sanitizeWikiLinkForHref('')).toBeNull();
        expect(sanitizeWikiLinkForHref('   ')).toBeNull();
        expect(sanitizeWikiLinkForHref(null)).toBeNull();
        expect(sanitizeWikiLinkForHref(undefined)).toBeNull();
    });

    it('returns null for inputs with control characters', () => {
        expect(sanitizeWikiLinkForHref('http://example.com/\u0000')).toBeNull();
        expect(sanitizeWikiLinkForHref('http://example.com/\u001F')).toBeNull();
        expect(sanitizeWikiLinkForHref('http://example.com/\u007F')).toBeNull();
    });

    it('returns null for protocol-relative URLs', () => {
        expect(sanitizeWikiLinkForHref('//example.com')).toBeNull();
        expect(sanitizeWikiLinkForHref('//example.com/path')).toBeNull();
    });

    it('returns null for malformed local links', () => {
        expect(sanitizeWikiLinkForHref('/path/with"quotes')).toBeNull();
        expect(sanitizeWikiLinkForHref('/path/with\'quotes')).toBeNull();
        expect(sanitizeWikiLinkForHref('/path/with<tags>')).toBeNull();
        expect(sanitizeWikiLinkForHref('/path/with`ticks')).toBeNull();
        expect(sanitizeWikiLinkForHref('/path/with spaces')).toBeNull();
    });

    it('returns raw value for valid local links', () => {
        expect(sanitizeWikiLinkForHref('#anchor')).toBe('#anchor');
        expect(sanitizeWikiLinkForHref('/local/path')).toBe('/local/path');
        expect(sanitizeWikiLinkForHref('./relative/path')).toBe('./relative/path');
        expect(sanitizeWikiLinkForHref('../up/path')).toBe('../up/path');
    });

    it('returns parsed href for valid HTTP/HTTPS URLs', () => {
        expect(sanitizeWikiLinkForHref('http://example.com')).toBe('http://example.com/');
        expect(sanitizeWikiLinkForHref('https://example.com/path')).toBe('https://example.com/path');
        expect(sanitizeWikiLinkForHref('HTTP://EXAMPLE.COM')).toBe('http://example.com/');
    });

    it('returns null for invalid or unsupported URL protocols', () => {
        expect(sanitizeWikiLinkForHref('javascript:alert(1)')).toBeNull();
        expect(sanitizeWikiLinkForHref('data:text/html,<script>alert(1)</script>')).toBeNull();
        expect(sanitizeWikiLinkForHref('ftp://example.com')).toBeNull();
        expect(sanitizeWikiLinkForHref('mailto:test@example.com')).toBeNull();
        expect(sanitizeWikiLinkForHref('not-a-url')).toBeNull();
    });
});
