const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const formatStart = appSource.indexOf('function formatPropertiesForPopup(properties, hasFollowingDescription) {');
const sanitizeStart = appSource.indexOf('function escapeHtml(value) {');
const escapeStart = appSource.indexOf('function escapeForSingleQuotedAttribute(value) {');
const wikiLinkStart = appSource.indexOf('function sanitizeWikiLinkForHref(value) {');
const resolveStart = appSource.indexOf('function resolveLinkedMapData(featureData) {');
const popupStart = appSource.indexOf('function createPopupContent(data, type) {');
const popupEnd = appSource.indexOf('// --- Auto-generate a reverse map for quick lookup (Type -> Group) ---');

if (
    formatStart === -1 ||
    sanitizeStart === -1 ||
    escapeStart === -1 ||
    resolveStart === -1 ||
    popupStart === -1 ||
    popupEnd === -1
) {
    throw new Error('Could not locate createPopupContent dependencies in js/app.js');
}

const formatSource = appSource.slice(formatStart, sanitizeStart);
const sanitizeSource = appSource.slice(sanitizeStart, escapeStart);
const escapeSource = appSource.slice(escapeStart, wikiLinkStart !== -1 ? wikiLinkStart : resolveStart);
const wikiLinkSource = wikiLinkStart !== -1 ? appSource.slice(wikiLinkStart, resolveStart) : '';
const popupSource = appSource.slice(popupStart, popupEnd);

// Minimal dependency stub for this regression check.
function resolveLinkedMapData() {
    return null;
}

// eslint-disable-next-line no-eval
eval(formatSource);
// eslint-disable-next-line no-eval
eval(sanitizeSource);
// eslint-disable-next-line no-eval
eval(escapeSource);
if (wikiLinkSource) {
    // eslint-disable-next-line no-eval
    eval(wikiLinkSource);
} else {
    // Backward compatibility for pre-fix snapshots.
    global.sanitizeWikiLinkForHref = (value) => value;
}
// eslint-disable-next-line no-eval
eval(popupSource);

const popupHtml = createPopupContent(
    {
        name: `Old <Lin> "Watch" O\\Brien`,
        description: 'A test location.'
    },
    'poi'
);

assert.ok(
    popupHtml.includes('<h3>Old &lt;Lin&gt; &quot;Watch&quot; O\\Brien</h3>'),
    'popup title should escape HTML-sensitive characters'
);

assert.ok(
    popupHtml.includes(`onclick="copyFeatureLink(this, 'poi', 'Old &lt;Lin&gt; &quot;Watch&quot; O\\\\Brien')"`),
    'share link handler argument should preserve backslashes safely'
);

const unsafeHtml = createPopupContent(
    {
        name: 'Unsafe Example',
        pronunciation: '<img src=x onerror=alert(1)>',
        summary: '<script>alert("summary")</script>',
        description: '<svg onload=alert("description")></svg>'
    },
    'poi'
);

assert.ok(
    !unsafeHtml.includes('<script>alert("summary")</script>'),
    'summary should not render raw script tags'
);
assert.ok(
    !unsafeHtml.includes('<svg onload=alert("description")></svg>'),
    'description should not render raw SVG payloads'
);
assert.ok(
    !unsafeHtml.includes('<img src=x onerror=alert(1)>'),
    'pronunciation should not render raw HTML'
);

const javascriptLinkHtml = createPopupContent(
    {
        name: 'Unsafe Link',
        wikiLink: 'javascript:alert(1)',
        description: 'desc'
    },
    'poi'
);
assert.ok(
    !javascriptLinkHtml.includes('href="javascript:alert(1)"'),
    'javascript wikiLink should not render as href'
);
assert.ok(
    javascriptLinkHtml.includes('<h3>Unsafe Link</h3>'),
    'invalid wikiLink should fall back to plain header'
);

const injectedAttributeHtml = createPopupContent(
    {
        name: 'Injected Link',
        wikiLink: 'https://example.com" onclick="alert(1)',
        description: 'desc'
    },
    'poi'
);
assert.ok(
    !injectedAttributeHtml.includes('onclick="alert(1)"'),
    'wikiLink should not allow attribute injection'
);
assert.ok(
    injectedAttributeHtml.includes('<h3>Injected Link</h3>'),
    'malformed wikiLink should fall back to plain header'
);

const relativeLinkHtml = createPopupContent(
    {
        name: 'Relative Link',
        wikiLink: '/wiki/page',
        description: 'desc'
    },
    'poi'
);
assert.ok(
    relativeLinkHtml.includes('href="/wiki/page"'),
    'relative wikiLink should be allowed'
);

const hashLinkHtml = createPopupContent(
    {
        name: 'Hash Link',
        wikiLink: '#section-1',
        description: 'desc'
    },
    'poi'
);
assert.ok(
    hashLinkHtml.includes('href="#section-1"'),
    'hash wikiLink should be allowed'
);

console.log('createPopupContent regression checks passed');
