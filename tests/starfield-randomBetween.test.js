const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/starfield.js', 'utf8');

const start = source.indexOf('function randomBetween(');
const end = source.indexOf('function createStars()', start);
const code = source.substring(start, end);

eval(code);

// Test positive ranges
for (let i = 0; i < 100; i++) {
    const val = randomBetween(5, 10);
    assert.ok(val >= 5 && val < 10, `Expected 5 <= ${val} < 10`);
}

// Test negative ranges
for (let i = 0; i < 100; i++) {
    const val = randomBetween(-10, -5);
    assert.ok(val >= -10 && val < -5, `Expected -10 <= ${val} < -5`);
}

// Test mixed ranges
for (let i = 0; i < 100; i++) {
    const val = randomBetween(-5, 5);
    assert.ok(val >= -5 && val < 5, `Expected -5 <= ${val} < 5`);
}

// Test min === max
const valZeroDiff = randomBetween(7, 7);
assert.equal(valZeroDiff, 7);

console.log('starfield randomBetween checks passed');
