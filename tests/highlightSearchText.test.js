const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Read the js/app.js file
const appJsPath = path.resolve(__dirname, '../js/app.js');
const appJsSource = fs.readFileSync(appJsPath, 'utf8');

function extractFunction(source, functionName, nextFunctionName) {
    const startString = `function ${functionName}`;
    const startIndex = source.indexOf(startString);
    if (startIndex === -1) throw new Error(`Function ${functionName} not found`);

    let endIndex;
    if (nextFunctionName) {
        const endString = `function ${nextFunctionName}`;
        endIndex = source.indexOf(endString, startIndex);
        if (endIndex === -1) throw new Error(`Next function ${nextFunctionName} not found`);
    } else {
        endIndex = source.length;
    }

    return source.substring(startIndex, endIndex);
}

class MockNode {
    constructor() {
        this.childNodes = [];
    }
    appendChild(child) {
        this.childNodes.push(child);
    }
    get textContent() {
        return this.childNodes.map(c => c.textContent).join('');
    }
    set textContent(v) {
        this.childNodes = [new MockTextNode(v)];
    }
}

class MockDocumentFragment extends MockNode {
    get isFragment() { return true; }
}

class MockElement extends MockNode {
    constructor(tagName) {
        super();
        this.tagName = tagName;
        this.className = '';
    }
}

class MockTextNode extends MockNode {
    constructor(text) {
        super();
        this._textContent = text;
    }
    get textContent() {
        return this._textContent;
    }
    set textContent(v) {
        this._textContent = v;
    }
}

global.document = {
    createDocumentFragment: () => new MockDocumentFragment(),
    createElement: (tag) => new MockElement(tag),
    createTextNode: (text) => new MockTextNode(text)
};

const highlightSource = extractFunction(appJsSource, 'highlightSearchText', 'scheduleIdleTask');

let highlightSearchText;

(function() {
    eval(`highlightSearchText = ${highlightSource}`);
})();

describe('highlightSearchText', () => {
    it('returns a document fragment with textContent if no regex is provided', () => {
        const text = "hello world";
        const result = highlightSearchText(text, null);
        assert.ok(result.isFragment, 'Result should be a DocumentFragment');
        assert.strictEqual(result.textContent, text);
    });

    it('highlights matches correctly', () => {
        const text = "hello world and World";
        const regex = /world/gi;
        const result = highlightSearchText(text, regex);

        assert.strictEqual(result.childNodes.length, 4);
        assert.strictEqual(result.childNodes[0].textContent, "hello ");

        const highlight1 = result.childNodes[1];
        assert.strictEqual(highlight1.tagName, "span");
        assert.strictEqual(highlight1.className, "search-result-highlight");
        assert.strictEqual(highlight1.textContent, "world");

        assert.strictEqual(result.childNodes[2].textContent, " and ");

        const highlight2 = result.childNodes[3];
        assert.strictEqual(highlight2.tagName, "span");
        assert.strictEqual(highlight2.className, "search-result-highlight");
        assert.strictEqual(highlight2.textContent, "World");
    });

    it('safely handles malicious input strings containing HTML tags without rendering them', () => {
        const text = "<script>alert(1)</script>";
        const regex = /alert/gi;
        const result = highlightSearchText(text, regex);

        assert.strictEqual(result.childNodes.length, 3);
        assert.strictEqual(result.childNodes[0].textContent, "<script>");

        const highlight = result.childNodes[1];
        assert.strictEqual(highlight.tagName, "span");
        assert.strictEqual(highlight.textContent, "alert");

        assert.strictEqual(result.childNodes[2].textContent, "(1)</script>");
        assert.strictEqual(result.textContent, text);
    });

    it('highlights HTML entities properly without double-escaping or breaking structure', () => {
        const text = "&amp; and < and >";
        const regex = /&amp;/gi;
        const result = highlightSearchText(text, regex);

        assert.strictEqual(result.childNodes.length, 2);

        const highlight = result.childNodes[0];
        assert.strictEqual(highlight.tagName, "span");
        assert.strictEqual(highlight.textContent, "&amp;");

        assert.strictEqual(result.childNodes[1].textContent, " and < and >");
    });
});
