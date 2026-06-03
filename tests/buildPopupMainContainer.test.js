const assert = require('node:assert/strict');
const fs = require('node:fs');

(function() {
    const appSource = fs.readFileSync('js/app.js', 'utf8');

    const buildStart = appSource.indexOf('function buildPopupMainContainer(safeSummary, fullContentInnerHtml, hasSummary, hasFullContent) {');
    const buildEnd = appSource.indexOf('// --- Auto-generate a reverse map for quick lookup (Type -> Group) ---');

    if (buildStart === -1 || buildEnd === -1) {
        throw new Error('Could not locate buildPopupMainContainer in js/app.js');
    }

    const buildSource = appSource.slice(buildStart, buildEnd);

    // eslint-disable-next-line no-eval
    eval(buildSource);

    // test case 1: hasSummary = true, hasFullContent = true
    let result = buildPopupMainContainer('A safe summary', '<p>Full content</p>', true, true);
    assert.ok(result.mainContent.includes('<div class="popup-summary">'), 'Should contain summary container');
    assert.ok(result.mainContent.includes('<p>A safe summary</p>'), 'Should contain safe summary');
    assert.ok(result.mainContent.includes('<div class="popup-full-content">'), 'Should contain full content container');
    assert.ok(result.mainContent.includes('<p>Full content</p>'), 'Should contain full content inner HTML');
    assert.ok(result.readMoreButton.includes('<button type="button" class="popup-read-more" aria-expanded="false" onclick="togglePopupExpand(this)">Read More</button>'), 'Should contain read more button');

    // test case 2: hasSummary = true, hasFullContent = false
    result = buildPopupMainContainer('A safe summary', '<p>Full content</p>', true, false);
    assert.ok(result.mainContent.includes('<div class="popup-summary">'), 'Should contain summary container');
    assert.ok(result.mainContent.includes('<p>A safe summary</p>'), 'Should contain safe summary');
    assert.ok(result.mainContent.includes('<div class="popup-full-content">'), 'Should contain full content container');
    assert.ok(result.mainContent.includes('<p>Full content</p>'), 'Should contain full content inner HTML');
    assert.equal(result.readMoreButton, '', 'Read more button should be empty');

    // test case 3: hasSummary = false, hasFullContent = true
    result = buildPopupMainContainer('A safe summary', '<p>Full content</p>', false, true);
    assert.ok(!result.mainContent.includes('<div class="popup-summary">'), 'Should NOT contain summary container');
    assert.ok(!result.mainContent.includes('<p>A safe summary</p>'), 'Should NOT contain safe summary');
    assert.ok(!result.mainContent.includes('<div class="popup-full-content">'), 'Should NOT contain full content container');
    assert.ok(result.mainContent.includes('<p>Full content</p>'), 'Should contain full content inner HTML');
    assert.ok(result.readMoreButton.includes('<button type="button" class="popup-read-more" aria-expanded="false" onclick="togglePopupExpand(this)">Read More</button>'), 'Should contain read more button');

    // test case 4: hasSummary = false, hasFullContent = false
    result = buildPopupMainContainer('A safe summary', '<p>Full content</p>', false, false);
    assert.ok(!result.mainContent.includes('<div class="popup-summary">'), 'Should NOT contain summary container');
    assert.ok(!result.mainContent.includes('<p>A safe summary</p>'), 'Should NOT contain safe summary');
    assert.ok(!result.mainContent.includes('<div class="popup-full-content">'), 'Should NOT contain full content container');
    assert.ok(result.mainContent.includes('<p>Full content</p>'), 'Should contain full content inner HTML');
    assert.equal(result.readMoreButton, '', 'Read more button should be empty');

    console.log('buildPopupMainContainer tests passed');
})();