const fs = require('node:fs');
const { performance } = require('node:perf_hooks');

const appSourcePath = process.env.SEARCH_BENCH_APP_SOURCE || 'js/app.js';
const appSource = fs.readFileSync(appSourcePath, 'utf8');

function extractFunctionSource(name, { optional = false } = {}) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) {
        if (optional) return '';
        throw new Error(`Could not find function ${name}`);
    }
    let depth = 0;
    let end = -1;
    for (let i = start; i < appSource.length; i += 1) {
        const char = appSource[i];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                end = i + 1;
                break;
            }
        }
    }
    if (end === -1) {
        throw new Error(`Could not parse function ${name}`);
    }
    return appSource.slice(start, end);
}

const snippets = [
    extractFunctionSource('getSecondarySearchMatchCache', { optional: true }),
    extractFunctionSource('rememberSecondarySearchMatch', { optional: true }),
    extractFunctionSource('getFuzzyMatchScore'),
    extractFunctionSource('checkPrimarySearchMatch'),
    extractFunctionSource('checkSecondarySearchMatch'),
    extractFunctionSource('computePrecomputedSearchMatch')
].filter(Boolean).join('\n');

// eslint-disable-next-line no-eval
eval(snippets);

const itemCount = Number(process.env.SEARCH_BENCH_ITEMS || 8000);
const rounds = Number(process.env.SEARCH_BENCH_ROUNDS || 8);
const terms = [
    'swcst',
    'mnrte',
    'hdaqe',
    'crwnrd',
    'qzzqx',
    'vltsp',
    'rbmkt',
    'wntrgt'
];

const secondaryTemplate = [
    'silver watch coast road causeway',
    'winter gate marker route under moonrise',
    'hidden archive quarter eastward',
    'ribbon market district with old canal stones',
    'vault spiral passage below the crown ridge',
    'amber lantern ferry crossing and river dock',
    'overgrown sentinel tower with civic records',
    'storm chapel overlook beside blackwater marsh'
].join(' ');

function buildEntries() {
    return Array.from({ length: itemCount }, (_, index) => ({
        primary: `marker ${index}`,
        secondary: `${secondaryTemplate} ${index} ${secondaryTemplate}`,
        context: {}
    }));
}

function runBenchmark(entries) {
    let checksum = 0;
    const startedAt = performance.now();
    for (let round = 0; round < rounds; round += 1) {
        for (const term of terms) {
            for (const entry of entries) {
                const match = computePrecomputedSearchMatch(term, entry.primary, entry.secondary, entry.context);
                checksum += match.matched ? match.score : -1;
            }
        }
    }
    return {
        checksum,
        elapsedMs: performance.now() - startedAt
    };
}

const coldResult = runBenchmark(buildEntries());
const warmEntries = buildEntries();
runBenchmark(warmEntries);
const warmResult = runBenchmark(warmEntries);

if (coldResult.checksum !== warmResult.checksum) {
    throw new Error(`Benchmark checksums diverged: cold=${coldResult.checksum}, warm=${warmResult.checksum}`);
}

console.log(JSON.stringify({
    appSourcePath,
    itemCount,
    rounds,
    termCount: terms.length,
    operations: itemCount * rounds * terms.length,
    coldElapsedMs: Number(coldResult.elapsedMs.toFixed(2)),
    warmElapsedMs: Number(warmResult.elapsedMs.toFixed(2)),
    checksum: warmResult.checksum
}, null, 2));
