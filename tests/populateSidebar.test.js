const fs = require('fs');
const assert = require('node:assert/strict');

(() => {
    // Minimal mock classes to emulate DOM
    class MockElement {
        constructor(tag) {
            this.tagName = tag.toLowerCase();
            this.children = [];
            this.className = '';
            this.textContent = '';
            this._innerHTML = '';
        }
        set innerHTML(val) {
            this._innerHTML = val;
            if (val === '') this.children = [];
        }
        get innerHTML() { return this._innerHTML; }
        appendChild(child) {
            this.children.push(child);
        }
    }

    // Set up global dependencies
    global.document = {
        createElement(tag) {
            return new MockElement(tag);
        }
    };

    global.createSidebarFolderItem = function(item) {
        const el = document.createElement('li');
        el.textContent = 'Folder: ' + item.name;
        return el;
    };

    global.createSidebarMapItem = function(item) {
        const el = document.createElement('li');
        el.textContent = 'Map: ' + item.name;
        return el;
    };

    let lucideRefreshed = false;
    global.refreshLucideIcons = function() {
        lucideRefreshed = true;
    };

    // Load code from js/app.js
    const code = fs.readFileSync('js/app.js', 'utf8');

    // Extract getMapPresetGroupLabel
    const startGroupLabel = code.indexOf('function getMapPresetGroupLabel(item) {');
    const endGroupLabel = code.indexOf('function createSidebarFolderItem(item) {');
    const getMapPresetGroupLabelSrc = code.substring(startGroupLabel, endGroupLabel);
    eval(getMapPresetGroupLabelSrc);

    // Extract createSidebarListItem
    const startListItem = code.indexOf('function createSidebarListItem(item) {');
    const endListItem = code.indexOf('function createSidebarGroupItem(groupLabel, sourceItems) {');
    const createSidebarListItemSrc = code.substring(startListItem, endListItem);
    eval(createSidebarListItemSrc);

    // Extract createSidebarGroupItem
    const startGroupItem = code.indexOf('function createSidebarGroupItem(groupLabel, sourceItems) {');
    const endGroupItem = code.indexOf('function populateSidebar(parentElement, items) {');
    const createSidebarGroupItemSrc = code.substring(startGroupItem, endGroupItem);
    eval(createSidebarGroupItemSrc);

    // Extract populateSidebar
    const startPopulate = code.indexOf('function populateSidebar(parentElement, items) {');
    const endPopulate = code.indexOf('// populateSidebar is now called within initializeApp after data is loaded');
    const populateSidebarSrc = code.substring(startPopulate, endPopulate);
    eval(populateSidebarSrc);

    // Test Cases

    // 1. Ungrouped list
    const parent1 = new MockElement('div');
    lucideRefreshed = false;
    populateSidebar(parent1, [
        { type: 'map', name: 'Map1' },
        { type: 'folder', name: 'Folder1' }
    ]);
    assert.equal(parent1.children.length, 2);
    assert.equal(parent1.children[0].textContent, 'Map: Map1');
    assert.equal(parent1.children[1].textContent, 'Folder: Folder1');
    assert.equal(lucideRefreshed, true);

    // 2. Grouped list mixed with ungrouped
    const parent2 = new MockElement('div');
    lucideRefreshed = false;
    populateSidebar(parent2, [
        { type: 'map', name: 'Map2' },
        { type: 'map', name: 'Map3', group: 'My Group' },
        { type: 'map', name: 'Map4', group: 'My Group' },
        { type: 'map', name: 'Map5', group: 'Another Group' }
    ]);
    assert.equal(parent2.children.length, 3);
    assert.equal(parent2.children[0].textContent, 'Map: Map2');

    const myGroup = parent2.children[1];
    assert.equal(myGroup.tagName, 'li');
    assert.equal(myGroup.className, 'map-preset-group');
    assert.equal(myGroup.children.length, 2); // header, ul
    assert.equal(myGroup.children[0].className, 'map-preset-group-header');
    assert.equal(myGroup.children[0].textContent, 'My Group');
    assert.equal(myGroup.children[1].className, 'map-preset-group-list');
    assert.equal(myGroup.children[1].children.length, 2);
    assert.equal(myGroup.children[1].children[0].textContent, 'Map: Map3');
    assert.equal(myGroup.children[1].children[1].textContent, 'Map: Map4');

    const anotherGroup = parent2.children[2];
    assert.equal(anotherGroup.children[1].children.length, 1);
    assert.equal(anotherGroup.children[1].children[0].textContent, 'Map: Map5');
    assert.equal(lucideRefreshed, true);

    // 3. Empty list
    const parent3 = new MockElement('div');
    lucideRefreshed = false;
    populateSidebar(parent3, []);
    assert.equal(parent3.children.length, 0);
    assert.equal(lucideRefreshed, true);

    // 4. Null inputs
    const parent4 = new MockElement('div');
    lucideRefreshed = false;
    populateSidebar(parent4, null);
    assert.equal(parent4.children.length, 0);
    assert.equal(lucideRefreshed, false);

    // 5. Missing parentElement
    lucideRefreshed = false;
    populateSidebar(null, []);
    assert.equal(lucideRefreshed, false);

    // 6. Invalid items input (not an array)
    const parent6 = new MockElement('div');
    lucideRefreshed = false;
    populateSidebar(parent6, "not an array");
    assert.equal(parent6.children.length, 0);
    assert.equal(lucideRefreshed, false);

    console.log('populateSidebar regression checks passed');
})();
