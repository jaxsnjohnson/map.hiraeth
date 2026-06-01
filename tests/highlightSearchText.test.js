const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const appJsPath = path.resolve(__dirname, '../js/app.js');
const appJsSource = fs.readFileSync(appJsPath, 'utf8');

function extractFunction(source, functionName, nextFunctionName) {
    const startString = `function ${functionName}`;
    const startIndex = source.indexOf(startString);
    if (startIndex === -1) throw new Error(`Function ${functionName} not found`);

    const endString = `function ${nextFunctionName}`;
    const endIndex = source.indexOf(endString, startIndex);
    if (endIndex === -1) throw new Error(`Next function ${nextFunctionName} not found`);

    return source.substring(startIndex, endIndex);
}

class MockNode {
    constructor() {
        this.childNodes = [];
    }

    appendChild(child) {
        this.childNodes.push(child);
        return child;
    }

    get textContent() {
        return this.childNodes.map(child => child.textContent).join('');
    }

    set textContent(value) {
        this.childNodes = [new MockTextNode(value)];
    }
}

class MockDocumentFragment extends MockNode {
    get isFragment() {
        return true;
    }
}

class MockElement extends MockNode {
    constructor(tagName) {
        super();
        this.tagName = tagName;
        this.className = '';
    }
}

class MockTextNode {
    constructor(text) {
        this._textContent = text;
    }

    get textContent() {
        return this._textContent;
    }

    set textContent(value) {
        this._textContent = value;
    }
}

global.document = {
    createDocumentFragment: () => new MockDocumentFragment(),
    createElement: tag => new MockElement(tag),
    createTextNode: text => new MockTextNode(text)
};

const highlightSource = extractFunction(appJsSource, 'highlightSearchText', 'scheduleIdleTask');
let highlightSearchText;

// eslint-disable-next-line no-eval
eval(`highlightSearchText = ${highlightSource}`);

describe('highlightSearchText', () => {
    it('returns a document fragment with text content if no regex is provided', () => {
        const text = 'hello world';
        const result = highlightSearchText(text, null);

        assert.equal(result.isFragment, true);
        assert.equal(result.textContent, text);
    });

    it('highlights global matches correctly', () => {
        const result = highlightSearchText('hello world and World', /world/gi);

        assert.equal(result.childNodes.length, 4);
        assert.equal(result.childNodes[0].textContent, 'hello ');
        assert.equal(result.childNodes[1].tagName, 'span');
        assert.equal(result.childNodes[1].className, 'search-result-highlight');
        assert.equal(result.childNodes[1].textContent, 'world');
        assert.equal(result.childNodes[2].textContent, ' and ');
        assert.equal(result.childNodes[3].tagName, 'span');
        assert.equal(result.childNodes[3].textContent, 'World');
    });

    it('keeps malicious HTML as text nodes', () => {
        const text = '<script>alert(1)</script>';
        const result = highlightSearchText(text, /alert/gi);

        assert.equal(result.childNodes.length, 3);
        assert.equal(result.childNodes[0].textContent, '<script>');
        assert.equal(result.childNodes[1].tagName, 'span');
        assert.equal(result.childNodes[1].textContent, 'alert');
        assert.equal(result.childNodes[2].textContent, '(1)</script>');
        assert.equal(result.textContent, text);
    });

    it('highlights HTML entities without double escaping', () => {
        const result = highlightSearchText('&amp; and < and >', /&amp;/gi);

        assert.equal(result.childNodes.length, 2);
        assert.equal(result.childNodes[0].tagName, 'span');
        assert.equal(result.childNodes[0].textContent, '&amp;');
        assert.equal(result.childNodes[1].textContent, ' and < and >');
    });

    it('handles non-global regexes without looping forever', () => {
        const result = highlightSearchText('Hello world and world test!', /world/i);

        assert.equal(result.childNodes.length, 5);
        assert.equal(result.childNodes[0].textContent, 'Hello ');
        assert.equal(result.childNodes[1].tagName, 'span');
        assert.equal(result.childNodes[1].textContent, 'world');
        assert.equal(result.childNodes[2].textContent, ' and ');
        assert.equal(result.childNodes[3].tagName, 'span');
        assert.equal(result.childNodes[3].textContent, 'world');
        assert.equal(result.childNodes[4].textContent, ' test!');
    });
});
