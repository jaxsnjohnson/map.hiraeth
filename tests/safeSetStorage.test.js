const assert = require('node:assert/strict');
const fs = require('node:fs');

(() => {
    const appSource = fs.readFileSync('js/app.js', 'utf8');
    const fnStart = appSource.indexOf('function safeSetStorage(key, value) {');
    const fnEnd = appSource.indexOf('function safeRemoveStorage(key) {');

    if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
        throw new Error('Could not locate safeSetStorage in js/app.js');
    }

    const fnSource = appSource.slice(fnStart, fnEnd);

    let setKeys = {};
    let shouldThrow = false;

    // Mock localStorage globally
    global.localStorage = {
        setItem: (key, value) => {
            if (shouldThrow) {
                throw new Error('Storage quota exceeded');
            }
            setKeys[key] = value;
        }
    };

    // Evaluate the source
    // eslint-disable-next-line no-eval
    eval(fnSource);

    console.log('localStorage mock setup ready.');

    // Test 1: Successful set
    setKeys = {};
    safeSetStorage('validKey', 'validValue');
    assert.equal(setKeys['validKey'], 'validValue');

    safeSetStorage('anotherKey', 'anotherValue');
    assert.equal(setKeys['validKey'], 'validValue');
    assert.equal(setKeys['anotherKey'], 'anotherValue');

    // Test 2: localStorage throws an error
    shouldThrow = true;
    try {
        safeSetStorage('errorKey', 'errorValue');
        // Should not throw, and setKeys shouldn't change
        assert.equal(setKeys['errorKey'], undefined);
    } catch (e) {
        assert.fail('safeSetStorage should swallow exceptions from localStorage.setItem');
    }

    console.log('safeSetStorage checks passed');
})();
