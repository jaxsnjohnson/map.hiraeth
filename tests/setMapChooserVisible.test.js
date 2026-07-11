const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

const startMarker = 'function setMapChooserVisible(visible) {';
const endMarker = 'function getMapChooserEntryText(item) {';

const start = appSource.indexOf(startMarker);
const end = appSource.indexOf(endMarker, start);

if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate setMapChooserVisible in js/app.js');
}

const snippet = appSource.slice(start, end);

let mapChooserElement = null;
let bodyElement = null;
let mapChooserCloseBtn = null;
let requestAnimationFrame = callback => callback();

// eslint-disable-next-line no-eval
eval(snippet);

function createClassList(initialClasses = []) {
    const classes = new Set(initialClasses);
    const toggleCalls = [];

    return {
        toggleCalls,
        contains(className) {
            return classes.has(className);
        },
        toggle(className, force) {
            toggleCalls.push({ className, force });
            const shouldAdd = force === undefined ? !classes.has(className) : Boolean(force);
            if (shouldAdd) {
                classes.add(className);
            } else {
                classes.delete(className);
            }
            return shouldAdd;
        }
    };
}

function createElement({ hidden = true, classes = [] } = {}) {
    return {
        hidden,
        attributes: {},
        classList: createClassList(classes),
        setAttribute(name, value) {
            this.attributes[name] = value;
        }
    };
}

mapChooserElement = createElement({ hidden: true });
bodyElement = createElement();
let closeFocusCount = 0;
mapChooserCloseBtn = {
    focus(options) {
        closeFocusCount += 1;
        assert.deepEqual(options, { preventScroll: true });
    }
};

setMapChooserVisible(true);

assert.equal(mapChooserElement.hidden, false, 'map chooser should be shown');
assert.equal(mapChooserElement.attributes['aria-hidden'], 'false', 'map chooser should be exposed to assistive tech');
assert.equal(mapChooserElement.classList.contains('visible'), true, 'map chooser should have visible class');
assert.deepEqual(
    mapChooserElement.classList.toggleCalls.at(-1),
    { className: 'visible', force: true },
    'map chooser visible class should be forced on'
);
assert.equal(bodyElement.classList.contains('map-chooser-open'), true, 'body should track the open chooser state');
assert.equal(closeFocusCount, 1, 'opening the full-screen chooser should move focus into it');
assert.deepEqual(
    bodyElement.classList.toggleCalls.at(-1),
    { className: 'map-chooser-open', force: true },
    'body open class should be forced on'
);

setMapChooserVisible(false);

assert.equal(mapChooserElement.hidden, true, 'map chooser should be hidden');
assert.equal(mapChooserElement.attributes['aria-hidden'], 'true', 'map chooser should be hidden from assistive tech');
assert.equal(mapChooserElement.classList.contains('visible'), false, 'map chooser should remove visible class');
assert.deepEqual(
    mapChooserElement.classList.toggleCalls.at(-1),
    { className: 'visible', force: false },
    'map chooser visible class should be forced off'
);
assert.equal(bodyElement.classList.contains('map-chooser-open'), false, 'body should clear the open chooser state');
assert.equal(closeFocusCount, 1, 'closing the chooser should not focus its hidden close control');
assert.deepEqual(
    bodyElement.classList.toggleCalls.at(-1),
    { className: 'map-chooser-open', force: false },
    'body open class should be forced off'
);

bodyElement = createElement({ classes: ['map-chooser-open'] });
mapChooserElement = null;

assert.doesNotThrow(() => {
    setMapChooserVisible(true);
}, 'missing map chooser should be ignored');
assert.equal(
    bodyElement.classList.contains('map-chooser-open'),
    true,
    'missing map chooser should not mutate body state'
);

mapChooserElement = createElement({ hidden: true });
bodyElement = null;

assert.doesNotThrow(() => {
    setMapChooserVisible(true);
}, 'missing body element should be ignored');
assert.equal(mapChooserElement.hidden, false, 'map chooser should still be shown without a body element');
assert.equal(mapChooserElement.attributes['aria-hidden'], 'false', 'aria state should still update without a body element');
assert.equal(mapChooserElement.classList.contains('visible'), true, 'visible class should still update without a body element');

console.log('setMapChooserVisible regression checks passed');
