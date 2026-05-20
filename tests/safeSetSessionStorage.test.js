const assert = require('node:assert/strict');
const fs = require('node:fs');

(function() {
    const appSource = fs.readFileSync('js/app.js', 'utf8');
    const fnStart = appSource.indexOf('function safeSetSessionStorage(key, value) {');
    const fnEnd = appSource.indexOf('function safeGetJSON(key, fallback = null) {');

    if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
        throw new Error('Could not locate safeSetSessionStorage function in js/app.js');
    }

    const fnSource = appSource.slice(fnStart, fnEnd);

    let storedItems = {};
    let shouldThrow = false;

    // Mock sessionStorage globally
    const originalSessionStorage = global.sessionStorage;
    global.sessionStorage = {
        setItem: (key, value) => {
            if (shouldThrow) {
                throw new Error('Storage quota exceeded');
            }
            storedItems[key] = value;
        }
    };

    try {
        // Evaluate the source
        // eslint-disable-next-line no-eval
        eval(fnSource);

        console.log('sessionStorage mock setup ready.');

        // Test 1: Successful string setItem
        storedItems = {};
        safeSetSessionStorage('validKey', 'hello');
        assert.equal(storedItems['validKey'], 'hello');

        // Test 2: Successful setItem with JSON
        storedItems = {};
        safeSetSessionStorage('jsonKey', '{"success":true,"count":42}');
        assert.equal(storedItems['jsonKey'], '{"success":true,"count":42}');

        // Test 3: Exception handling (e.g., quota exceeded)
        shouldThrow = true;
        storedItems = {};
        // Should not throw an error, error is caught silently
        safeSetSessionStorage('validKey', 'test');
        shouldThrow = false; // reset flag
        // Verify that the operation failed silently without setting
        assert.equal(storedItems['validKey'], undefined);

        console.log('safeSetSessionStorage checks passed');
    } finally {
        // Restore original mock/object
        if (originalSessionStorage) {
            global.sessionStorage = originalSessionStorage;
        } else {
            delete global.sessionStorage;
        }
    }
})();
