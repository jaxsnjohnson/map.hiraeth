const fs = require('fs');

function normalizeSearchValue(value) {
    return String(value || '').trim().toLowerCase();
}

function getFuzzyMatchScore(term, target) {
    if (!term || !target) return -1;
    let searchIndex = 0;
    let lastMatchIndex = -1;
    let spreadPenalty = 0;

    for (const char of term) {
        const foundIndex = target.indexOf(char, searchIndex);
        if (foundIndex === -1) {
            return -1;
        }
        if (lastMatchIndex !== -1) {
            spreadPenalty += (foundIndex - lastMatchIndex - 1);
        }
        lastMatchIndex = foundIndex;
        searchIndex = foundIndex + 1;
    }

    const maxSpread = term.length * 3;
    if (spreadPenalty > maxSpread) {
        return -1;
    }

    const baseScore = 200 - (spreadPenalty * 5);
    return Math.max(10, baseScore);
}

function computeSearchMatchOld(term, primaryText, secondaryText = '') {
    const normalizedPrimary = normalizeSearchValue(primaryText);
    const normalizedSecondary = normalizeSearchValue(secondaryText);
    if (!term || !normalizedPrimary) return { matched: false, score: -1, matchedByContent: false };

    if (normalizedPrimary === term) {
        return { matched: true, score: 520, matchedByContent: false };
    }
    if (normalizedPrimary.startsWith(term)) {
        return { matched: true, score: 430, matchedByContent: false };
    }
    const primaryIndex = normalizedPrimary.indexOf(term);
    if (primaryIndex >= 0) {
        return { matched: true, score: 320 - Math.min(primaryIndex, 120), matchedByContent: false };
    }

    const fuzzyScore = getFuzzyMatchScore(term, normalizedPrimary);
    if (fuzzyScore >= 0) {
        return { matched: true, score: fuzzyScore, matchedByContent: false };
    }

    if (normalizedSecondary) {
        if (normalizedSecondary.includes(term)) {
            return { matched: true, score: 180, matchedByContent: true };
        }
        const fuzzySecondaryScore = getFuzzyMatchScore(term, normalizedSecondary);
        if (fuzzySecondaryScore >= 0) {
            return { matched: true, score: Math.max(80, fuzzySecondaryScore - 40), matchedByContent: true };
        }
    }

    return { matched: false, score: -1, matchedByContent: false };
}

function computeSearchMatchNew(term, primaryText, secondaryText = '') {
    const normalizedPrimary = normalizeSearchValue(primaryText);
    if (!term || !normalizedPrimary) return { matched: false, score: -1, matchedByContent: false };

    if (normalizedPrimary === term) {
        return { matched: true, score: 520, matchedByContent: false };
    }
    if (normalizedPrimary.startsWith(term)) {
        return { matched: true, score: 430, matchedByContent: false };
    }
    const primaryIndex = normalizedPrimary.indexOf(term);
    if (primaryIndex >= 0) {
        return { matched: true, score: 320 - Math.min(primaryIndex, 120), matchedByContent: false };
    }

    const fuzzyScore = getFuzzyMatchScore(term, normalizedPrimary);
    if (fuzzyScore >= 0) {
        return { matched: true, score: fuzzyScore, matchedByContent: false };
    }

    const normalizedSecondary = normalizeSearchValue(secondaryText);
    if (normalizedSecondary) {
        if (normalizedSecondary.includes(term)) {
            return { matched: true, score: 180, matchedByContent: true };
        }
        const fuzzySecondaryScore = getFuzzyMatchScore(term, normalizedSecondary);
        if (fuzzySecondaryScore >= 0) {
            return { matched: true, score: Math.max(80, fuzzySecondaryScore - 40), matchedByContent: true };
        }
    }

    return { matched: false, score: -1, matchedByContent: false };
}


const testStrings = [];
for (let i = 0; i < 1000; i++) {
    testStrings.push(`This is a primary ${i}`);
}
const secondaryStrings = [];
for (let i = 0; i < 1000; i++) {
    secondaryStrings.push(`This is a very long secondary string that requires normalization. It has a lot of words ${i}.`.repeat(5));
}

console.time('Old');
for (let j = 0; j < 100; j++) {
    for (let i = 0; i < testStrings.length; i++) {
        computeSearchMatchOld('primary', testStrings[i], secondaryStrings[i]);
    }
}
console.timeEnd('Old');

console.time('New');
for (let j = 0; j < 100; j++) {
    for (let i = 0; i < testStrings.length; i++) {
        computeSearchMatchNew('primary', testStrings[i], secondaryStrings[i]);
    }
}
console.timeEnd('New');
