const assert = require('node:assert/strict');
const fs = require('node:fs');

(() => {
    const appConfigSource = fs.readFileSync('js/app-config.js', 'utf8');

    // Extract function using indexOf
    const start = appConfigSource.indexOf('function setMeta(');
    if (start === -1) throw new Error('Could not find function setMeta');

    const end = appConfigSource.indexOf('function setIcon(', start);
    if (end === -1) throw new Error('Could not find end of function setMeta');

    const snippet = appConfigSource.slice(start, end);

    // Evaluate the function
    let setMeta;
    // eslint-disable-next-line no-eval
    eval(`setMeta = ${snippet}`);

    // Mock document structure
    function createMockDocument() {
        const headChildren = [];
        const elements = {}; // simulate elements by selector for querySelector

        const mockHead = {
            appendChild: (el) => headChildren.push(el)
        };

        const mockDocument = {
            head: mockHead,
            querySelector: (sel) => elements[sel] || null,
            createElement: (tag) => {
                const attributes = {};
                return {
                    tagName: tag,
                    attributes,
                    setAttribute: function(name, val) { this.attributes[name] = val; }
                };
            },
            _setMockElement: (sel, el) => { elements[sel] = el; },
            _getHeadChildren: () => headChildren
        };

        return mockDocument;
    }

    // Test 1: Undefined documentRef
    assert.doesNotThrow(() => {
        setMeta(undefined, 'meta[name="description"]', 'name', 'description', 'test');
    });

    // Test 2: Null documentRef
    assert.doesNotThrow(() => {
        setMeta(null, 'meta[name="description"]', 'name', 'description', 'test');
    });

    // Test 3: Element does not exist
    let doc = createMockDocument();
    setMeta(doc, 'meta[name="description"]', 'name', 'description', 'test content');

    let children = doc._getHeadChildren();
    assert.equal(children.length, 1, 'Should append one element to head');
    assert.equal(children[0].tagName, 'meta', 'Should create a meta element');
    assert.equal(children[0].attributes['name'], 'description', 'Should set attribute name=description');
    assert.equal(children[0].attributes['content'], 'test content', 'Should set content attribute');

    // Test 4: Element already exists
    doc = createMockDocument();
    const existingElement = {
        attributes: { name: 'description', content: 'old content' },
        setAttribute: function(name, val) { this.attributes[name] = val; }
    };
    doc._setMockElement('meta[name="description"]', existingElement);

    setMeta(doc, 'meta[name="description"]', 'name', 'description', 'new content');

    children = doc._getHeadChildren();
    assert.equal(children.length, 0, 'Should not append a new element to head');
    assert.equal(existingElement.attributes['name'], 'description', 'Original attribute should remain');
    assert.equal(existingElement.attributes['content'], 'new content', 'Content attribute should be updated');

    console.log('setMeta tests passed');
})();
