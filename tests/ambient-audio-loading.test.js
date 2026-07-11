const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const lightAmbient = { id: 'light' };
const darkAmbient = { id: 'dark' };
const selectorStart = appSource.indexOf('function getAmbientAudioForTheme(theme) {');
const selectorEnd = appSource.indexOf('function ensureAmbientTrackLoadedForTheme', selectorStart);

assert.notEqual(selectorStart, -1);
assert.notEqual(selectorEnd, -1);
// eslint-disable-next-line no-eval
eval(appSource.slice(selectorStart, selectorEnd));

assert.equal(getAmbientAudioForTheme('light'), lightAmbient);
assert.equal(getAmbientAudioForTheme('dark'), darkAmbient);
assert.equal(getAmbientAudioForTheme('system'), lightAmbient);

assert.match(
    appSource,
    /function getAmbientAudioForTheme\(theme\) \{\s*return theme === 'dark' \? darkAmbient : lightAmbient;\s*\}/
);
assert.match(
    appSource,
    /function ensureAmbientTrackLoadedForTheme\(theme = currentEffectiveTheme\) \{\s*ensureAmbientAudioLoaded\(getAmbientAudioForTheme\(theme\)\);\s*\}/
);
assert.doesNotMatch(appSource, /ensureAmbientTracksLoaded/);
assert.doesNotMatch(
    appSource,
    /ensureAmbientAudioLoaded\(lightAmbient\);\s*ensureAmbientAudioLoaded\(darkAmbient\)/
);
assert.match(
    appSource,
    /function scheduleSavedAmbientAudioResume\(\) \{[\s\S]*scheduleIdleTask\([\s\S]*window\.addEventListener\('load', resumeAfterStartup, \{ once: true \}\)/,
    'remembered ambient audio should wait until startup work has settled'
);
assert.match(
    appSource,
    /if \(soundEnabled && canUseSoundNow\) \{[\s\S]*setSoundIcon\(true\);[\s\S]*scheduleSavedAmbientAudioResume\(\);/,
    'initial sound state should preserve the enabled UI without immediately downloading the track'
);

console.log('ambient audio lazy-loading checks passed');
