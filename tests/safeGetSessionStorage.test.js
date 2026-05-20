(function() {
    const assert = require('node:assert/strict');
    const fs = require('node:fs');

    const appSource = fs.readFileSync('js/app.js', 'utf8');
    const fnStart = appSource.indexOf('function safeGetSessionStorage(key) {');
    const fnEnd = appSource.indexOf('function safeSetSessionStorage(key, value) {');

    if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
        throw new Error('Could not locate safeGetSessionStorage in js/app.js');
    }

    const fnSource = appSource.slice(fnStart, fnEnd);

    let getItemMock;

    const originalSessionStorage = global.sessionStorage;

    // Mock sessionStorage globally
    global.sessionStorage = {
        getItem: (key) => getItemMock(key)
    };

    // Evaluate the source
    // eslint-disable-next-line no-eval
    eval(fnSource);

    // Test 1: Successful retrieval
    getItemMock = (key) => {
        if (key === 'validKey') return 'someValue';
        return null;
    };
    assert.equal(safeGetSessionStorage('validKey'), 'someValue');

    // Test 2: Missing key returns null
    assert.equal(safeGetSessionStorage('missingKey'), null);

    // Test 3: Exception returns null
    getItemMock = (key) => {
        throw new Error('Access denied to sessionStorage');
    };
    assert.equal(safeGetSessionStorage('restrictedKey'), null);

    // Restore original global
    global.sessionStorage = originalSessionStorage;

    console.log('safeGetSessionStorage checks passed');
})();