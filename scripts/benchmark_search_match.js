const fs = require('node:fs');
const { performance } = require('node:perf_hooks');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractFunctionSource(name) {
    const start = appSource.indexOf(`function ${name}(`);
    if (start === -1) {
        throw new Error(`Could not find function ${name}`);
    }

    let depth = 0;
    for (let i = start; i < appSource.length; i += 1) {
        const char = appSource[i];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return appSource.slice(start, i + 1);
            }
        }
    }

    throw new Error(`Could not parse function ${name}`);
}

const snippets = [
    extractFunctionSource('getFuzzyMatchScore'),
    extractFunctionSource('checkPrimarySearchMatch')
].join('\n');

// eslint-disable-next-line no-eval
eval(snippets);

function legacyCheckPrimarySearchMatch(term, normalizedPrimary) {
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
    return null;
}

function buildCorpus() {
    const corpus = [];
    const terms = ['harbor', 'gate', 'market', 'route', 'spire', 'temple', 'watch', 'river'];
    for (let i = 0; i < 600; i += 1) {
        for (const term of terms) {
            const lastChar = term[term.length - 1];
            corpus.push([term, term]);
            corpus.push([term, `${term} district ${i}`]);
            corpus.push([term, `lower ${term} district ${i}`]);
            corpus.push([term, `${'x'.repeat(145)} ${term} ${i}`]);
            corpus.push([term, `${term[0]}-${term.slice(1, -1)}-${lastChar} waypoint ${i}`]);
            corpus.push([term, `unrelated waypoint ${i}`]);
        }
    }
    return corpus;
}

function runBenchmark(label, matcher, corpus, iterations) {
    const start = performance.now();
    let checksum = 0;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        for (const [term, normalizedPrimary] of corpus) {
            const match = matcher(term, normalizedPrimary);
            if (match) {
                checksum += match.score;
                if (match.matchedByContent) checksum += 1;
            }
        }
    }

    return {
        label,
        durationMs: performance.now() - start,
        checksum
    };
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
}

const corpus = buildCorpus();
const iterations = Number.parseInt(process.env.SEARCH_BENCH_ITERATIONS || '80', 10);
const rounds = Number.parseInt(process.env.SEARCH_BENCH_ROUNDS || '9', 10);
const legacyDurations = [];
const currentDurations = [];
let legacyChecksum = 0;
let currentChecksum = 0;

runBenchmark('warmup legacy', legacyCheckPrimarySearchMatch, corpus, 5);
runBenchmark('warmup current', checkPrimarySearchMatch, corpus, 5);

for (let round = 0; round < rounds; round += 1) {
    const first = round % 2 === 0
        ? [
            ['legacy', legacyCheckPrimarySearchMatch],
            ['current', checkPrimarySearchMatch]
        ]
        : [
            ['current', checkPrimarySearchMatch],
            ['legacy', legacyCheckPrimarySearchMatch]
        ];

    for (const [label, matcher] of first) {
        const result = runBenchmark(label, matcher, corpus, iterations);
        if (label === 'legacy') {
            legacyDurations.push(result.durationMs);
            legacyChecksum = result.checksum;
        } else {
            currentDurations.push(result.durationMs);
            currentChecksum = result.checksum;
        }
    }
}

if (legacyChecksum !== currentChecksum) {
    throw new Error(`Benchmark checksums diverged: legacy=${legacyChecksum}, current=${currentChecksum}`);
}

const legacyMedian = median(legacyDurations);
const currentMedian = median(currentDurations);
const delta = legacyMedian - currentMedian;
const percent = legacyMedian === 0 ? 0 : (delta / legacyMedian) * 100;

console.log(`Corpus entries: ${corpus.length}`);
console.log(`Iterations per round: ${iterations}`);
console.log(`Rounds: ${rounds}`);
console.log(`Legacy median: ${legacyMedian.toFixed(2)} ms`);
console.log(`Current median: ${currentMedian.toFixed(2)} ms`);
console.log(`Delta: ${delta.toFixed(2)} ms (${percent.toFixed(2)}%)`);
console.log(`Checksum: ${currentChecksum}`);
