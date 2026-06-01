const { performance } = require('perf_hooks');

const JSDOM = require('jsdom').JSDOM;
const dom = new JSDOM(`
    <div id="container">
        <input type="checkbox">
        <input type="checkbox">
        <input type="checkbox">
        <input type="checkbox">
        <input type="checkbox">
        <input type="checkbox">
        <input type="checkbox">
        <input type="checkbox">
        <input type="checkbox">
        <input type="checkbox">
    </div>
`);
const document = dom.window.document;
const poiFilterCheckboxesLive = document.getElementById('container').getElementsByTagName('input');

let staticCheckboxes = [];
function updateStaticCheckboxes() {
    staticCheckboxes = Array.from(poiFilterCheckboxesLive);
}

function testWithArrayFrom() {
    let count = 0;
    const staticCheckboxes = Array.from(poiFilterCheckboxesLive);
    for (let i = 0; i < staticCheckboxes.length; i++) {
        if (staticCheckboxes[i].type === 'checkbox') count++;
    }
    return count;
}

function testWithCachedArray() {
    let count = 0;
    for (let i = 0; i < staticCheckboxes.length; i++) {
        if (staticCheckboxes[i].type === 'checkbox') count++;
    }
    return count;
}

updateStaticCheckboxes();

const ITERATIONS = 100000;

console.log('Warming up...');
for (let i = 0; i < 1000; i++) {
    testWithArrayFrom();
    testWithCachedArray();
}

console.log('Testing testWithArrayFrom...');
const start1 = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    testWithArrayFrom();
}
const end1 = performance.now();

console.log('Testing testWithCachedArray...');
const start2 = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    testWithCachedArray();
}
const end2 = performance.now();

console.log(`With Array.from inside: ${end1 - start1} ms`);
console.log(`With Cached Array: ${end2 - start2} ms`);
console.log(`Improvement: ${((end1 - start1) - (end2 - start2)) / (end1 - start1) * 100}%`);
