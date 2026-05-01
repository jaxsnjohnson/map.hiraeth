function normalizeSearchValueOld(value) {
    if (!value || typeof value !== 'string') return '';
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const cache = new Map();
function normalizeSearchValueNew(value) {
    if (!value || typeof value !== 'string') return '';
    let cached = cache.get(value);
    if (cached !== undefined) return cached;
    const normalized = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    cache.set(value, normalized);
    return normalized;
}

const testStrings = [];
for (let i = 0; i < 1000; i++) {
    testStrings.push(`This is a test string with some diacritics like é and à ${i}`);
}

console.time('Old');
for (let j = 0; j < 100; j++) {
    for (const str of testStrings) {
        normalizeSearchValueOld(str);
    }
}
console.timeEnd('Old');

console.time('New');
for (let j = 0; j < 100; j++) {
    for (const str of testStrings) {
        normalizeSearchValueNew(str);
    }
}
console.timeEnd('New');
