const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const formatStart = appSource.indexOf('function formatPropertiesForPopup(properties, hasFollowingDescription) {');
const sanitizeStart = appSource.indexOf('function sanitizeTextForHtml(value) {');
const escapeStart = appSource.indexOf('function escapeForSingleQuotedAttribute(value) {');
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
const escapeSource = appSource.slice(escapeStart, resolveStart);
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
    popupHtml.includes(`onclick="copyFeatureLink(this, 'poi', 'Old <Lin> \"Watch\" O\\\\Brien')"`),
    'share link handler argument should preserve backslashes safely'
);

console.log('createPopupContent regression checks passed');
