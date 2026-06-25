const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const functionNames = ['syncBottomBarHeightVariable'];

let extractedCode = '';
for (const fnName of functionNames) {
    const fnRegex = new RegExp(`function\\s+${fnName}\\s*\\([\\s\\S]*?\\)\\s*{`);
    const match = appSource.match(fnRegex);
    if (!match) throw new Error(`Could not find function ${fnName}`);

    let startIndex = match.index;
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let endIndex = startIndex;

    for (let i = startIndex; i < appSource.length; i++) {
        const char = appSource[i];
        const prevChar = i > 0 ? appSource[i-1] : '';

        if (!inString && (char === "'" || char === '"' || char === '`')) {
            inString = true;
            stringChar = char;
        } else if (inString && char === stringChar && prevChar !== '\\') {
            inString = false;
        } else if (!inString) {
            if (char === '{') braceCount++;
            else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
    }
    extractedCode += appSource.slice(startIndex, endIndex) + '\n\n';
}

const sandbox = {
    isEmbeddedView: false,
    document: {
        getElementById: () => null
    },
    rootElement: {
        style: {
            setProperty: () => {}
        }
    },
    console,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean
};

vm.createContext(sandbox);
vm.runInContext(extractedCode, sandbox);

let setPropertyCall = null;
sandbox.rootElement.style.setProperty = (key, val) => {
    setPropertyCall = { key, val };
};

// Test 1: Element missing
sandbox.isEmbeddedView = false;
sandbox.document.getElementById = (id) => null;
sandbox.syncBottomBarHeightVariable();
assert.deepEqual(setPropertyCall, { key: '--bottom-link-bar-height', val: '0px' });

// Test 2: isEmbeddedView is true
setPropertyCall = null;
sandbox.isEmbeddedView = true;
sandbox.document.getElementById = (id) => ({
    style: { display: 'block' },
    getBoundingClientRect: () => ({ height: 40.2 })
});
sandbox.syncBottomBarHeightVariable();
assert.deepEqual(setPropertyCall, { key: '--bottom-link-bar-height', val: '0px' });

// Test 3: Element hidden
setPropertyCall = null;
sandbox.isEmbeddedView = false;
sandbox.document.getElementById = (id) => ({
    style: { display: 'none' },
    getBoundingClientRect: () => ({ height: 40.2 })
});
sandbox.syncBottomBarHeightVariable();
assert.deepEqual(setPropertyCall, { key: '--bottom-link-bar-height', val: '0px' });

// Test 4: Happy path (rounds up height)
setPropertyCall = null;
sandbox.isEmbeddedView = false;
sandbox.document.getElementById = (id) => ({
    style: { display: 'block' },
    getBoundingClientRect: () => ({ height: 40.2 })
});
sandbox.syncBottomBarHeightVariable();
assert.deepEqual(setPropertyCall, { key: '--bottom-link-bar-height', val: '41px' });

console.log('syncBottomBarHeightVariable test passed');
