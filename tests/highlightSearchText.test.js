const assert = require('assert');
const fs = require('fs');

const appJsSource = fs.readFileSync('./js/app.js', 'utf8');

const funcStr = appJsSource.slice(
    appJsSource.indexOf('function highlightSearchText(text, searchRegex)'),
    appJsSource.indexOf('function scheduleIdleTask(callback, timeout = 900)')
);

let highlightSearchText;
eval(`highlightSearchText = ${funcStr}`);

describe('highlightSearchText', () => {
    it('should correctly return a DocumentFragment and highlight text without using innerHTML', () => {
        const mockDocument = {
            createDocumentFragment() {
                return {
                    children: [],
                    appendChild(node) { this.children.push(node); }
                };
            },
            createTextNode(text) {
                return { type: 'text', content: text };
            },
            createElement(tag) {
                return { type: tag, className: '', textContent: '' };
            }
        };

        global.document = mockDocument;

        const fragment = highlightSearchText("Hello <world> and test!", new RegExp("world", "gi"));

        assert.strictEqual(fragment.children.length, 3);
        assert.strictEqual(fragment.children[0].content, "Hello <");
        assert.strictEqual(fragment.children[1].type, "span");
        assert.strictEqual(fragment.children[1].textContent, "world");
        assert.strictEqual(fragment.children[2].content, "> and test!");
    });

    it('should correctly return DocumentFragment with text node if searchRegex is null', () => {
        const mockDocument = {
            createDocumentFragment() {
                return {
                    children: [],
                    appendChild(node) { this.children.push(node); }
                };
            },
            createTextNode(text) {
                return { type: 'text', content: text };
            },
            createElement(tag) {
                return { type: tag, className: '', textContent: '' };
            }
        };

        global.document = mockDocument;

        const fragment = highlightSearchText("Hello <world> and test!", null);

        assert.strictEqual(fragment.children.length, 1);
        assert.strictEqual(fragment.children[0].type, "text");
        assert.strictEqual(fragment.children[0].content, "Hello <world> and test!");
    });

    it('should handle non-global searchRegex correctly without infinite loop', () => {
        const mockDocument = {
            createDocumentFragment() {
                return {
                    children: [],
                    appendChild(node) { this.children.push(node); }
                };
            },
            createTextNode(text) {
                return { type: 'text', content: text };
            },
            createElement(tag) {
                return { type: tag, className: '', textContent: '' };
            }
        };

        global.document = mockDocument;

        // Non-global regex
        const fragment = highlightSearchText("Hello world and world test!", new RegExp("world"));

        assert.strictEqual(fragment.children.length, 3);
        assert.strictEqual(fragment.children[0].content, "Hello ");
        assert.strictEqual(fragment.children[1].type, "span");
        assert.strictEqual(fragment.children[1].textContent, "world");
        assert.strictEqual(fragment.children[2].content, " and world test!");
    });
});
