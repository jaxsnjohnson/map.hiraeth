const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/shared-utils.js', 'utf8');

function extractFunctionSource(name) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < appSource.length; i += 1) {
        const char = appSource[i];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }
    if (end === -1) {
        throw new Error(`Could not parse function ${name}`);
    }
    return appSource.slice(start, end);
}

const snippets = extractFunctionSource('debounce');

// eslint-disable-next-line no-eval
eval(snippets);

async function runTests() {
    console.log('Running debounce tests...');

    // Test 1: Function is not called immediately and is called after wait
    let callCount = 0;
    const fn1 = debounce(() => { callCount += 1; }, 50);
    fn1();
    assert.equal(callCount, 0, 'Function should not be called immediately');

    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(callCount, 1, 'Function should be called after wait time');

    // Test 2: Multiple calls within wait time reset the timer
    let callCount2 = 0;
    const fn2 = debounce(() => { callCount2 += 1; }, 50);
    fn2();
    fn2();
    fn2();
    assert.equal(callCount2, 0, 'Function should not be called immediately on multiple calls');

    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(callCount2, 1, 'Function should only be called once after multiple rapid calls');

    // Test 3: Context and arguments are properly passed
    let passedContext = null;
    let passedArgs = null;
    const contextObj = { value: 42 };

    const fn3 = debounce(function(...args) {
        passedContext = this;
        passedArgs = args;
    }, 50);

    fn3.call(contextObj, 'arg1', 'arg2');

    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(passedContext, contextObj, 'Context should be passed correctly');
    assert.deepEqual(passedArgs, ['arg1', 'arg2'], 'Arguments should be passed correctly');

    console.log('debounce tests passed');
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
