const assert = require('node:assert/strict');
const fs = require('node:fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const fnStart = appSource.indexOf('function updateCoordinateDisplay(');
const fnEnd = appSource.indexOf('function getUrlParameters(');

if (fnStart === -1 || fnEnd === -1 || fnEnd <= fnStart) {
    throw new Error('Could not locate updateCoordinateDisplay function in js/app.js');
}

const fnSource = appSource.slice(fnStart, fnEnd);

// Provide a minimal DOM stub so the function can write into it.
const spanEl = { innerHTML: '' };
global.coordinateDisplay = {
    querySelector(selector) {
        if (selector === 'span') return spanEl;
        return null;
    }
};

// Evaluate the production function source.
// eslint-disable-next-line no-eval
eval(fnSource);

updateCoordinateDisplay(10, 20);
assert.equal(spanEl.innerHTML, '10.00° N, 20.00° E');

updateCoordinateDisplay(-5, -122.5);
assert.equal(spanEl.innerHTML, '5.00° S, 122.50° W');

console.log('updateCoordinateDisplay regression checks passed');
