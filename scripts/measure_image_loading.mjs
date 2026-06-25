#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const defaultHistoryPath = 'performance/image-loading-history.json';
const defaultGraphPath = 'performance/image-loading-history.svg';

function parseArgs(argv) {
    const args = {
        runs: 3,
        map: '',
        label: '',
        history: defaultHistoryPath,
        graph: defaultGraphPath,
        append: true,
        viewport: '1280x720'
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (!arg.startsWith('--')) continue;
        const key = arg.slice(2);
        if (key === 'no-append') {
            args.append = false;
            continue;
        }
        if (key === 'refresh-history') {
            args.refreshHistory = true;
            continue;
        }
        const value = argv[index + 1];
        index += 1;
        args[key] = value;
    }

    if (!args.url && !args.refreshHistory) {
        throw new Error('Usage: node scripts/measure_image_loading.mjs --url <url> --label <label> [--runs 3] [--refresh-history]');
    }
    if (!args.label) args.label = args.url;
    args.runs = Math.max(1, Number.parseInt(args.runs, 10) || 1);
    return args;
}

function addCacheBust(rawUrl, runIndex) {
    const url = new URL(rawUrl);
    url.searchParams.set('perfRun', `${Date.now()}-${runIndex}`);
    return url.toString();
}

function parseViewport(value) {
    const match = String(value || '').match(/^(\d+)x(\d+)$/);
    if (!match) return { width: 1280, height: 720 };
    return {
        width: Number.parseInt(match[1], 10),
        height: Number.parseInt(match[2], 10)
    };
}

function median(values) {
    const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
    if (sorted.length === 0) return null;
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2) return sorted[middle];
    return (sorted[middle - 1] + sorted[middle]) / 2;
}

function roundMetric(value) {
    return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function summarizeRuns(runs) {
    const metricNames = [
        'domContentLoadedMs',
        'loadEventMs',
        'loadingHiddenMs',
        'firstVisualAssetEndMs',
        'firstMiniAssetEndMs',
        'firstTileAssetEndMs',
        'firstFullImageAssetEndMs',
        'tileCompleteMs',
        'visualAssetBytes'
    ];
    return Object.fromEntries(metricNames.map((name) => {
        const values = runs.map((run) => run[name]).filter((value) => Number.isFinite(value));
        return [name, {
            median: roundMetric(median(values)),
            min: roundMetric(values.length ? Math.min(...values) : null),
            max: roundMetric(values.length ? Math.max(...values) : null)
        }];
    }));
}

function firstResourceEnd(resources, predicate) {
    const matches = resources.filter(predicate);
    if (matches.length === 0) return null;
    return Math.min(...matches.map((resource) => resource.responseEnd));
}

function readHistory(historyPath) {
    if (!fs.existsSync(historyPath)) return { entries: [] };
    const parsed = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    if (Array.isArray(parsed)) return { entries: parsed };
    if (!Array.isArray(parsed.entries)) return { entries: [] };
    return parsed;
}

function writeHistory(historyPath, history) {
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    const payload = {
        generatedAt: new Date().toISOString(),
        entries: history.entries
    };
    fs.writeFileSync(historyPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function getSummaryMetric(entry, metricName) {
    return entry?.summary?.[metricName]?.median;
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function pointPath(entries, metricName, xForIndex, yForValue) {
    return entries
        .map((entry, index) => {
            const value = getSummaryMetric(entry, metricName);
            if (!Number.isFinite(value)) return '';
            return `${xForIndex(index)},${yForValue(value)}`;
        })
        .filter(Boolean)
        .join(' ');
}

function writeGraph(graphPath, history) {
    fs.mkdirSync(path.dirname(graphPath), { recursive: true });
    const entries = history.entries;
    const width = Math.max(720, entries.length * 180 + 120);
    const height = 420;
    const margin = { top: 32, right: 36, bottom: 110, left: 72 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const metrics = [
        { name: 'firstVisualAssetEndMs', label: 'First visual asset', color: '#0f766e' },
        { name: 'loadingHiddenMs', label: 'Loader hidden', color: '#b45309' },
        { name: 'tileCompleteMs', label: 'Visible tiles complete', color: '#2563eb' }
    ];
    const values = entries.flatMap((entry) => metrics.map((metric) => getSummaryMetric(entry, metric.name)))
        .filter((value) => Number.isFinite(value));
    const maxValue = Math.max(100, ...values);
    const yMax = Math.ceil(maxValue / 50) * 50;
    const xForIndex = (index) => {
        if (entries.length <= 1) return margin.left + plotWidth / 2;
        return margin.left + (plotWidth * index) / (entries.length - 1);
    };
    const yForValue = (value) => margin.top + plotHeight - (plotHeight * value) / yMax;
    const yTicks = [0, yMax / 4, yMax / 2, (3 * yMax) / 4, yMax];

    const lines = metrics.map((metric) => {
        const points = pointPath(entries, metric.name, xForIndex, yForValue);
        if (!points) return '';
        return `<polyline points="${points}" fill="none" stroke="${metric.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
    }).join('\n');

    const dots = entries.flatMap((entry, index) => metrics.map((metric) => {
        const value = getSummaryMetric(entry, metric.name);
        if (!Number.isFinite(value)) return '';
        return `<circle cx="${xForIndex(index)}" cy="${yForValue(value)}" r="4" fill="${metric.color}"><title>${escapeXml(entry.label)} ${escapeXml(metric.label)}: ${value} ms</title></circle>`;
    })).join('\n');

    const xLabels = entries.map((entry, index) => {
        const x = xForIndex(index);
        return `<text x="${x}" y="${height - 62}" text-anchor="end" transform="rotate(-35 ${x} ${height - 62})">${escapeXml(entry.label)}</text>`;
    }).join('\n');

    const yGrid = yTicks.map((tick) => {
        const y = yForValue(tick);
        return [
            `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#d6d3d1" stroke-width="1" />`,
            `<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${Math.round(tick)} ms</text>`
        ].join('\n');
    }).join('\n');

    const legend = metrics.map((metric, index) => {
        const x = margin.left + index * 185;
        return `<g transform="translate(${x}, ${height - 32})"><line x1="0" y1="0" x2="24" y2="0" stroke="${metric.color}" stroke-width="3" /><text x="32" y="5">${escapeXml(metric.label)}</text></g>`;
    }).join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Map image loading timing history</title>
  <desc id="desc">Median timing metrics recorded by scripts/measure_image_loading.mjs.</desc>
  <rect width="100%" height="100%" fill="#fff" />
  <text x="${margin.left}" y="24" font-size="18" font-family="system-ui, sans-serif" font-weight="700">Map Image Loading Timing History</text>
  <g font-family="system-ui, sans-serif" font-size="12" fill="#292524">
    ${yGrid}
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#78716c" />
    <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#78716c" />
    ${xLabels}
    ${lines}
    ${dots}
    ${legend}
  </g>
</svg>
`;
    fs.writeFileSync(graphPath, svg);
}

async function measureRun(browser, args, runIndex) {
    const context = await browser.newContext({
        serviceWorkers: 'block',
        viewport: parseViewport(args.viewport)
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
        window.__imageLoadingMeasure = { events: [] };
        const record = (name) => {
            const measure = window.__imageLoadingMeasure;
            if (!measure || measure.events.some((event) => event.name === name)) return;
            measure.events.push({ name, time: performance.now() });
        };
        const check = () => {
            const loading = document.getElementById('loading-indicator');
            if (loading && getComputedStyle(loading).display === 'none') record('loadingHidden');
            const mini = Array.from(document.querySelectorAll('img')).find((img) => /\.mini\.webp(?:\?|$)/.test(img.currentSrc || img.src) && img.complete && img.naturalWidth > 0);
            if (mini) record('miniImageComplete');
            const tile = Array.from(document.querySelectorAll('img.leaflet-tile')).find((img) => img.complete && img.naturalWidth > 0);
            if (tile) record('firstTileComplete');
            const full = Array.from(document.querySelectorAll('img.leaflet-image-layer')).find((img) => !/\.mini\.webp(?:\?|$)/.test(img.currentSrc || img.src) && img.complete && img.naturalWidth > 0);
            if (full) record('fullImageComplete');
            const tiles = Array.from(document.querySelectorAll('img.leaflet-tile'));
            if (tiles.length > 0 && tiles.every((img) => img.complete && img.naturalWidth > 0)) record('visibleTilesComplete');
        };
        document.addEventListener('DOMContentLoaded', () => {
            record('domContentLoaded');
            check();
            const interval = setInterval(check, 10);
            window.setTimeout(() => clearInterval(interval), 15000);
        });
        window.addEventListener('load', () => {
            record('windowLoad');
            check();
        });
    });

    const requestedUrl = addCacheBust(args.url, runIndex);
    await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#map', { timeout: 10000 });
    await page.waitForFunction(() => {
        const loading = document.getElementById('loading-indicator');
        return loading && getComputedStyle(loading).display === 'none';
    }, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => {
        const tiles = Array.from(document.querySelectorAll('img.leaflet-tile'));
        if (tiles.length > 0) return tiles.every((img) => img.complete && img.naturalWidth > 0);
        return Array.from(document.querySelectorAll('img.leaflet-image-layer')).some((img) => img.complete && img.naturalWidth > 0);
    }, { timeout: 15000 }).catch(() => {});

    const raw = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const resources = performance.getEntriesByType('resource')
            .filter((entry) => /(\/maps\/.*\.(?:webp|png|jpe?g)|\/tile\/.*\.webp)/.test(entry.name))
            .map((entry) => ({
                name: entry.name,
                startTime: entry.startTime,
                responseEnd: entry.responseEnd,
                duration: entry.duration,
                encodedBodySize: entry.encodedBodySize || 0,
                transferSize: entry.transferSize || 0
            }));
        return {
            events: window.__imageLoadingMeasure?.events || [],
            navigation: navigation ? {
                domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
                loadEventEnd: navigation.loadEventEnd
            } : null,
            resources,
            tileCount: document.querySelectorAll('img.leaflet-tile').length,
            imageLayerSources: Array.from(document.querySelectorAll('img.leaflet-image-layer')).map((img) => img.currentSrc || img.src)
        };
    });
    await context.close();

    const eventTime = (name) => raw.events.find((event) => event.name === name)?.time ?? null;
    const mapResources = raw.resources.map((resource) => ({
        ...resource,
        path: new URL(resource.name).pathname
    }));
    const firstMiniAssetEndMs = firstResourceEnd(mapResources, (resource) => /\.mini\.webp$/.test(resource.path));
    const firstTileAssetEndMs = firstResourceEnd(mapResources, (resource) => /\/tile\/.*\.webp$/.test(resource.path));
    const firstFullImageAssetEndMs = firstResourceEnd(mapResources, (resource) => /\/maps\/.*\.(webp|png|jpe?g)$/.test(resource.path) && !/\.mini\.webp$/.test(resource.path));
    const firstVisualAssetEndMs = firstResourceEnd(mapResources, () => true);

    return {
        run: runIndex + 1,
        requestedUrl,
        domContentLoadedMs: raw.navigation?.domContentLoadedEventEnd ?? eventTime('domContentLoaded'),
        loadEventMs: raw.navigation?.loadEventEnd ?? eventTime('windowLoad'),
        loadingHiddenMs: eventTime('loadingHidden'),
        firstVisualAssetEndMs,
        firstMiniAssetEndMs,
        firstTileAssetEndMs,
        firstFullImageAssetEndMs,
        tileCompleteMs: eventTime('visibleTilesComplete'),
        tileCount: raw.tileCount,
        imageLayerSources: raw.imageLayerSources,
        visualAssetBytes: mapResources.reduce((sum, resource) => sum + (resource.encodedBodySize || resource.transferSize || 0), 0),
        visualResources: mapResources
            .sort((left, right) => left.responseEnd - right.responseEnd)
            .slice(0, 12)
            .map((resource) => ({
                path: resource.path,
                responseEnd: roundMetric(resource.responseEnd),
                encodedBodySize: resource.encodedBodySize
            }))
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.refreshHistory) {
        const history = readHistory(args.history);
        history.entries = history.entries.map((entry) => ({
            ...entry,
            summary: summarizeRuns(entry.runs || [])
        }));
        writeHistory(args.history, history);
        writeGraph(args.graph, history);
        console.log(`Refreshed ${args.history}`);
        console.log(`Wrote ${args.graph}`);
        return;
    }

    const browser = await chromium.launch({ headless: true });
    const runs = [];
    try {
        for (let index = 0; index < args.runs; index += 1) {
            runs.push(await measureRun(browser, args, index));
        }
    } finally {
        await browser.close();
    }

    const entry = {
        timestamp: new Date().toISOString(),
        label: args.label,
        url: args.url,
        map: args.map,
        viewport: args.viewport,
        runs,
        summary: summarizeRuns(runs)
    };

    let history = readHistory(args.history);
    if (args.append) {
        history.entries.push(entry);
    } else {
        history = { entries: [entry] };
    }
    writeHistory(args.history, history);
    writeGraph(args.graph, history);
    console.log(JSON.stringify(entry, null, 2));
    console.log(`Wrote ${args.history}`);
    console.log(`Wrote ${args.graph}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
