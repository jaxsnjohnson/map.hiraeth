const assert = require('node:assert/strict');
const fs = require('node:fs');

// Mock DOMPurify as it would be globally available from the CDN script
global.DOMPurify = {
    sanitize: (html) => {
        if (!html) return html;
        // Super simple mock of DOMPurify for the test
        return html.replace(/<img[^>]+onerror[^>]+>/g, '').replace(/<script.*?>.*?<\/script>/g, '');
    }
};

const appSource = fs.readFileSync('js/app.js', 'utf8');

const escapeHtmlStart = appSource.indexOf('function escapeHtml(value) {');
const escapeHtmlEnd = appSource.indexOf('function escapeForSingleQuotedAttribute(value) {');
const renderStart = appSource.indexOf('function renderMapBlurbContent');
const renderEnd = appSource.indexOf('function getMobileMapListEntryCount');

if (escapeHtmlStart === -1 || escapeHtmlEnd === -1 || renderStart === -1 || renderEnd === -1) {
    throw new Error('Could not locate required functions in js/app.js');
}

const escapeHtmlSource = appSource.slice(escapeHtmlStart, escapeHtmlEnd);
const renderSource = appSource.slice(renderStart, renderEnd);

// Set up globals needed by the function
global.mapBlurbElement = {
    innerHTML: ''
};
global.isMobileLayoutActive = false;

// We do not need currentlyLoadedMapId or getMapRuntimeData to be real since we pass mapInfo directly
global.currentlyLoadedMapId = 'test';
global.getMapRuntimeData = () => ({});

// eslint-disable-next-line no-eval
eval(escapeHtmlSource);
// eslint-disable-next-line no-eval
eval(renderSource);

// Test safe HTML
renderMapBlurbContent({
    name: 'Test Map',
    blurb: '<p>This is a <strong>safe</strong> blurb with <a href="#">a link</a>.</p>'
});

assert.equal(
    global.mapBlurbElement.innerHTML,
    '<p>This is a <strong>safe</strong> blurb with <a href="#">a link</a>.</p>',
    'Safe HTML should be preserved'
);

// Test dangerous HTML
renderMapBlurbContent({
    name: 'Danger Map',
    blurb: '<p>Malicious code</p><img src=x onerror=alert(1)>'
});

assert.equal(
    global.mapBlurbElement.innerHTML.includes('onerror'),
    false,
    'Malicious onerror attribute should be sanitized'
);

// Test mobile layout
global.isMobileLayoutActive = true;
renderMapBlurbContent({
    name: 'Mobile Map',
    blurb: '<p>Mobile test</p><script>alert("xss")</script>'
});

assert.equal(
    global.mapBlurbElement.innerHTML.includes('<script>'),
    false,
    'Mobile blurb template should sanitize blurbBody'
);
assert.equal(
    global.mapBlurbElement.innerHTML.includes('Mobile test'),
    true,
    'Mobile blurb template should include safe text'
);

// Test fail closed when DOMPurify is missing
const originalDOMPurify = global.DOMPurify;
global.DOMPurify = undefined;
global.isMobileLayoutActive = false;

renderMapBlurbContent({
    name: 'No Purify Map',
    blurb: '<p>Dangerous <img></p>'
});

assert.equal(
    global.mapBlurbElement.innerHTML,
    '&lt;p&gt;Dangerous &lt;img&gt;&lt;/p&gt;',
    'Should escape HTML when DOMPurify is undefined'
);

// Restore for completion check
global.DOMPurify = originalDOMPurify;

console.log('renderMapBlurbContent sanitization tests passed');
