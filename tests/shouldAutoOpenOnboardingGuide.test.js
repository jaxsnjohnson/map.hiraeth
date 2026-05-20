const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const helperStart = appSource.indexOf('function shouldAutoOpenOnboardingGuide({');
const nextHelperStart = appSource.indexOf('function setElementHiddenState(element, hidden) {');

if (helperStart === -1 || nextHelperStart === -1 || nextHelperStart <= helperStart) {
    throw new Error('Could not locate shouldAutoOpenOnboardingGuide in js/app.js');
}

const helperSource = appSource.slice(helperStart, nextHelperStart);

// eslint-disable-next-line no-eval
eval(helperSource);

// Test default behavior (no arguments)
assert.equal(shouldAutoOpenOnboardingGuide(), true);

// Test empty object
assert.equal(shouldAutoOpenOnboardingGuide({}), true);

// Test individual properties set to true
assert.equal(shouldAutoOpenOnboardingGuide({ isEmbedded: true }), false);
assert.equal(shouldAutoOpenOnboardingGuide({ isMobileLayout: true }), false);
assert.equal(shouldAutoOpenOnboardingGuide({ hasSeenOnboarding: true }), false);

// Test individual properties explicitly set to false
assert.equal(shouldAutoOpenOnboardingGuide({ isEmbedded: false }), true);
assert.equal(shouldAutoOpenOnboardingGuide({ isMobileLayout: false }), true);
assert.equal(shouldAutoOpenOnboardingGuide({ hasSeenOnboarding: false }), true);

// Test combinations
assert.equal(shouldAutoOpenOnboardingGuide({ isEmbedded: true, isMobileLayout: true }), false);
assert.equal(shouldAutoOpenOnboardingGuide({ isEmbedded: false, isMobileLayout: true }), false);
assert.equal(shouldAutoOpenOnboardingGuide({ isEmbedded: false, isMobileLayout: false, hasSeenOnboarding: true }), false);
assert.equal(shouldAutoOpenOnboardingGuide({ isEmbedded: false, isMobileLayout: false, hasSeenOnboarding: false }), true);

console.log('shouldAutoOpenOnboardingGuide regression checks passed');
