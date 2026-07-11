const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const functionStart = appSource.indexOf('function syncFolderExpandedAria(folderListItem) {');
const functionEnd = appSource.indexOf('function getMapPresetGroupLabel(item) {', functionStart);
if (functionStart === -1 || functionEnd === -1) {
    throw new Error('Could not locate syncFolderExpandedAria in js/app.js');
}

// eslint-disable-next-line no-eval
eval(appSource.slice(functionStart, functionEnd));

const dom = new JSDOM(`
    <li class="folder closed">
        <div class="folder-header">
            <button class="folder-toggle-btn"></button>
            <button class="folder-main-action"></button>
        </div>
        <ul class="nested-list">
            <li class="map-item" tabindex="0">Nested map</li>
        </ul>
    </li>
`);
const folder = dom.window.document.querySelector('.folder');
const toggle = folder.querySelector('.folder-toggle-btn');
const mainAction = folder.querySelector('.folder-main-action');
const nestedList = folder.querySelector('.nested-list');

syncFolderExpandedAria(folder);
assert.equal(toggle.getAttribute('aria-expanded'), 'false');
assert.equal(mainAction.getAttribute('aria-expanded'), 'false');
assert.equal(nestedList.getAttribute('aria-hidden'), 'true');
assert.equal(nestedList.inert, true);

folder.classList.remove('closed');
syncFolderExpandedAria(folder);
assert.equal(toggle.getAttribute('aria-expanded'), 'true');
assert.equal(mainAction.getAttribute('aria-expanded'), 'true');
assert.equal(nestedList.getAttribute('aria-hidden'), 'false');
assert.equal(nestedList.inert, false);

assert.match(
    appSource,
    /if \(hasChildren && !isLoadable && !isComingSoon\) \{\s*toggleBtn\.tabIndex = -1;\s*toggleBtn\.setAttribute\('aria-hidden', 'true'\);/
);
const nestedListAppendIndex = appSource.indexOf('listItem.appendChild(nestedList);', appSource.indexOf('function createSidebarFolderItem'));
assert.ok(
    nestedListAppendIndex < appSource.indexOf('syncFolderExpandedAria(listItem);', nestedListAppendIndex),
    'initial folder accessibility state should be synchronized after children are mounted.'
);

console.log('sidebar folder accessibility checks passed');
