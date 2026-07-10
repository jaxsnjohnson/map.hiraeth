const assert = require('node:assert/strict');
const fs = require('node:fs');

(function() {
    const appSource = fs.readFileSync('js/app.js', 'utf8');

    // We need: escapeHtml, escapeForSingleQuotedAttribute, sanitizeWikiLinkForHref
    const utilsStart = appSource.indexOf('function escapeHtml(value) {');
    const utilsEnd = appSource.indexOf('function resolveLinkedMapData(featureData) {');

    const buildStart = appSource.indexOf('function buildPopupHeader(data, type, safePronunciation) {');
    const buildEnd = appSource.indexOf('function buildPopupFullContent(data, safeDescription) {');

    if (utilsStart === -1 || utilsEnd === -1 || buildStart === -1 || buildEnd === -1) {
        throw new Error('Could not locate required functions in js/app.js');
    }

    const utilsSource = appSource.slice(utilsStart, utilsEnd);
    const buildSource = appSource.slice(buildStart, buildEnd);

    // Mock resolveLinkedMapData
    global.mockLinkedMapData = null;
    function resolveLinkedMapData(data) {
        return global.mockLinkedMapData;
    }

    // eslint-disable-next-line no-eval
    eval(utilsSource);
    // eslint-disable-next-line no-eval
    eval(buildSource);

    // Helper to reset mocks
    function reset() {
        global.mockLinkedMapData = null;
    }

    // Test 1: Only data.name present (no type, no pronunciation, no linked map).
    reset();
    let result = buildPopupHeader({ name: 'Test Location' }, null, null);
    assert.ok(result.includes('<div class="popup-header-row"><h3>Test Location</h3></div>'), 'Should contain basic h3 with name');
    assert.ok(!result.includes('share-btn'), 'Should not contain share button without type');
    assert.ok(!result.includes('popup-map-jump'), 'Should not contain map jump without linked map');
    assert.ok(!result.includes('<em>'), 'Should not contain pronunciation');

    // Test 2: data.name and data.wikiLink present.
    reset();
    result = buildPopupHeader({ name: 'Wiki Location', wikiLink: 'https://example.com' }, null, null);
    assert.ok(result.includes('<a href="https://example.com/" target="_blank" rel="noopener noreferrer" title="Visit wiki page for Wiki Location">Wiki Location</a>'), 'Should contain wiki link');

    // Test 3: data.name and type present (with share button generated).
    reset();
    result = buildPopupHeader({ name: 'Shareable Location' }, 'poi', null);
    assert.ok(result.includes('<h3>Shareable Location</h3>'), 'Should contain basic h3');
    assert.ok(result.includes('<button class="share-btn" onclick="copyFeatureLink(this, \'poi\', \'Shareable Location\')"'), 'Should contain share button with correct params');
    assert.ok(result.includes('data-lucide="link-2"'), 'Should contain link icon');
    assert.ok(result.includes('class="popup-detail-expand"'), 'Should contain the detail sheet action');
    assert.ok(result.includes('onclick="return openSelectedFeatureDetails()"'), 'Detail action should open the selected feature sheet');
    assert.ok(result.includes('aria-haspopup="dialog"'), 'Detail action should expose its dialog relationship');

    // Test 4: data.name, type, and safePronunciation present.
    reset();
    result = buildPopupHeader({ name: 'Pronounced Location' }, 'poi', 'pro-NOWNST');
    assert.ok(result.includes('<h3>Pronounced Location</h3>'), 'Should contain basic h3');
    assert.ok(result.includes('<p style="margin-top: -10px; margin-bottom: 5px;"><em>pro-NOWNST</em></p>'), 'Should contain pronunciation');
    assert.ok(result.includes('share-btn'), 'Should contain share button');

    // Test 5: data.name and resolveLinkedMapData returning a valid object.
    reset();
    global.mockLinkedMapData = { id: 'linked-map-id', name: 'Linked Map Name' };
    result = buildPopupHeader({ name: 'Location with Link' }, null, null);
    assert.ok(result.includes('<div class="popup-map-jump">'), 'Should contain map jump container');
    assert.ok(result.includes('<a href="#" onclick="return openLinkedMapFromPopup(event, \'linked-map-id\')" title="Open map: Linked Map Name">'), 'Should contain map jump link');
    assert.ok(result.includes('<span>Open Linked Map Name map</span>'), 'Should contain span text for screen readers/label');

    // Test 6: No data.name, but safePronunciation present.
    reset();
    result = buildPopupHeader({}, null, 'pro-NOWNST');
    assert.ok(!result.includes('<h3>'), 'Should not contain h3');
    assert.ok(!result.includes('popup-header-row'), 'Should not contain header row');
    assert.ok(result.includes('<p style="margin-top: -10px; margin-bottom: 5px;"><em>pro-NOWNST</em></p>'), 'Should contain pronunciation');

    // Test 7: Empty object.
    reset();
    result = buildPopupHeader({}, null, null);
    assert.equal(result, '', 'Should return empty string for empty data');

    // Test 8: Special characters in name are escaped
    reset();
    result = buildPopupHeader({ name: '<script>alert("XSS")</script>' }, 'poi', null);
    assert.ok(result.includes('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'), 'Name should be escaped for HTML content');
    assert.ok(result.includes('copyFeatureLink(this, \'poi\', \'&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;\')'), 'Name should be escaped for attribute injection');

    console.log('buildPopupHeader tests passed');
})();
