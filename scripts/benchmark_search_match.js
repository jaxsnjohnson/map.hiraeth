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
    extractFunctionSource('getFuzzyMatchScore')
].join('\n');

// eslint-disable-next-line no-eval
eval(snippets);

function legacyGetFuzzyMatchScore(term, target) {
    if (!term || !target) return -1;
    let searchIndex = 0;
    let lastMatchIndex = -1;
    let spreadPenalty = 0;

    for (const char of term) {
        const foundIndex = target.indexOf(char, searchIndex);
        if (foundIndex === -1) return -1;
        if (lastMatchIndex >= 0) {
            spreadPenalty += Math.max(0, foundIndex - lastMatchIndex - 1);
        }
        lastMatchIndex = foundIndex;
        searchIndex = foundIndex + 1;
    }

    return Math.max(40, 160 - spreadPenalty);
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
    corpus.push(['😀a', '😀a']);
    corpus.push(['a😀', 'a😀']);
    corpus.push(['😀b', `😀${'x'.repeat(40)}b`]);
    return corpus;
}

function runBenchmark(label, scorer, corpus, iterations) {
    const start = performance.now();
    let checksum = 0;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
        for (const [term, target] of corpus) {
            checksum += scorer(term, target);
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

runBenchmark('warmup legacy', legacyGetFuzzyMatchScore, corpus, 5);
runBenchmark('warmup current', getFuzzyMatchScore, corpus, 5);

for (let round = 0; round < rounds; round += 1) {
    const first = round % 2 === 0
        ? [
            ['legacy', legacyGetFuzzyMatchScore],
            ['current', getFuzzyMatchScore]
        ]
        : [
            ['current', getFuzzyMatchScore],
            ['legacy', legacyGetFuzzyMatchScore]
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
console.log(`Legacy fuzzy median: ${legacyMedian.toFixed(2)} ms`);
console.log(`Current fuzzy median: ${currentMedian.toFixed(2)} ms`);
console.log(`Delta: ${delta.toFixed(2)} ms (${percent.toFixed(2)}%)`);
console.log(`Checksum: ${currentChecksum}`);
