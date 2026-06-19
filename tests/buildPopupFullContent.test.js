const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const escapeStart = appSource.indexOf('function escapeHtml(value) {');
const escapeEnd = appSource.indexOf('function escapeForSingleQuotedAttribute(value) {');

if (escapeStart === -1 || escapeEnd === -1) {
    throw new Error('Could not locate escapeHtml in js/app.js');
}

const formatStart = appSource.indexOf('function formatPropertiesForPopup(properties, hasFollowingDescription) {');
const formatEnd = appSource.indexOf('function escapeHtml(value) {');

if (formatStart === -1 || formatEnd === -1) {
    throw new Error('Could not locate formatPropertiesForPopup in js/app.js');
}

const buildStart = appSource.indexOf('function buildPopupFullContent(data, safeDescription) {');
const buildEnd = appSource.indexOf('function buildPopupMainContainer(safeSummary, fullContentInnerHtml, hasSummary, hasFullContent) {');

if (buildStart === -1 || buildEnd === -1) {
    throw new Error('Could not locate buildPopupFullContent in js/app.js');
}

const escapeSource = appSource.slice(escapeStart, escapeEnd);
const formatSource = appSource.slice(formatStart, formatEnd);
const buildSource = appSource.slice(buildStart, buildEnd);

let escapeHtml;
eval(`escapeHtml = ${escapeSource}`);

let formatPropertiesForPopup;
eval(`formatPropertiesForPopup = ${formatSource}`);

let buildPopupFullContent;
eval(`buildPopupFullContent = ${buildSource}`);

describe('buildPopupFullContent', () => {
    it('should safely escape malicious HTML in type and value', () => {
        const result = buildPopupFullContent({ type: '<script>alert(1)</script>', value: '<b>Oops</b>' }, 'Safe description');
        assert.ok(result.includes('<p><em>&lt;script&gt;alert(1)&lt;/script&gt;: &lt;b&gt;Oops&lt;/b&gt;</em></p>'));
    });

    it('should include region info and safe description for regions', () => {
        const result = buildPopupFullContent({ type: 'Region', value: 'North' }, 'Safe description');
        assert.ok(result.includes('<p><em>Region: North</em></p>'));
        assert.ok(result.includes('<p>Safe description</p>'));
    });

    it('should include POI info with capitalized type and no empty description block', () => {
        const result = buildPopupFullContent({ type: 'town' }, '');
        assert.ok(result.includes('<p><em>Type: Town</em></p>'));
        assert.ok(!result.includes('<p></p>'));
    });

    it('should include properties and safe description for data with properties', () => {
        const result = buildPopupFullContent({ type: 'road', properties: { Surface: 'Dirt', Length: '10 miles' } }, 'A long road');
        assert.ok(result.includes('<p><em>Type: Road</em></p>'));
        assert.ok(result.includes('<strong>Surface:</strong> Dirt'));
        assert.ok(result.includes('<strong>Length:</strong> 10 miles'));
        assert.ok(result.includes('<p>A long road</p>'));
    });

    it('should keep rich POI drawer fields out of compact popup content', () => {
        const result = buildPopupFullContent({
            type: 'town',
            detailSections: [{ heading: 'Current tensions', body: 'Full drawer-only detail.' }],
            tags: ['Capital', 'Free port']
        }, 'Safe description');

        assert.ok(result.includes('<p><em>Type: Town</em></p>'));
        assert.ok(result.includes('<p>Safe description</p>'));
        assert.ok(!result.includes('Current tensions'));
        assert.ok(!result.includes('Full drawer-only detail'));
        assert.ok(!result.includes('Free port'));
    });

    it('should include properties and no type info if type is absent', () => {
        const result = buildPopupFullContent({ properties: { Elevation: '1000m' } }, null);
        assert.ok(result.includes('<strong>Elevation:</strong> 1000m'));
        assert.ok(!result.includes('<p><em>'));
    });

    it('should return empty string for empty data and no description', () => {
        const result = buildPopupFullContent({}, '');
        assert.equal(result, '');
    });
});
