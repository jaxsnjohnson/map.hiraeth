#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const { generateAtlasIndex } = require('./generate_atlas_index.js');

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function isRenderableMapEntry(item) {
    if (!item || typeof item !== 'object') return false;
    return Boolean(item.id && item.imageUrl);
}

function isActiveInlineMapId(id) {
    const normalizedId = String(id || '');
    return normalizedId &&
        !normalizedId.startsWith('OLD-') &&
        !normalizedId.startsWith('DEV-') &&
        !normalizedId.startsWith('Archive-');
}

function normalizeChildIds(children) {
    if (!Array.isArray(children)) return undefined;
    const normalizedChildren = children
        .map((child) => {
            if (typeof child === 'string') return child;
            if (child && typeof child === 'object' && child.id) return child.id;
            return '';
        })
        .filter(Boolean);
    return normalizedChildren.length ? normalizedChildren : undefined;
}

function buildStandaloneMap(item) {
    const standalone = cloneJson(item);
    const normalizedChildren = normalizeChildIds(standalone.children);
    if (normalizedChildren) standalone.children = normalizedChildren;
    else delete standalone.children;
    delete standalone.dataUrl;
    return standalone;
}

function buildSlimManifestEntry(item) {
    const manifestEntry = {};
    const keysToCopy = [
        'id',
        'name',
        'type',
        'status',
        'visibility',
        'width',
        'height',
        'imageUrl',
        'mobileImageUrl',
        'imageUrlMobile',
        'smallImageUrl',
        'imageUrlSmall',
        'imageVariants',
        'latLonBounds',
        'scalePixels',
        'scaleKilometers',
        'scaleUnitName',
        'backgroundColor',
        'atmosphere',
        'blurb'
    ];

    keysToCopy.forEach((key) => {
        if (item[key] !== undefined) {
            manifestEntry[key] = cloneJson(item[key]);
        }
    });

    const normalizedChildren = normalizeChildIds(item.children);
    if (normalizedChildren) {
        manifestEntry.children = normalizedChildren;
    }

    const explicitDataUrl = String(item.dataUrl || '').trim();
    if (explicitDataUrl && explicitDataUrl !== `maps/${item.id}.json`) {
        manifestEntry.dataUrl = explicitDataUrl;
    }

    return manifestEntry;
}

function writeJsonFile(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function migrateTree(items, context) {
    return items.map((item) => {
        if (typeof item === 'string') return item;

        const migratedChildren = Array.isArray(item.children)
            ? migrateTree(item.children, context)
            : undefined;
        const hydratedItem = {
            ...cloneJson(item),
            ...(migratedChildren ? { children: migratedChildren } : {})
        };

        if (isRenderableMapEntry(hydratedItem)) {
            const standaloneMap = buildStandaloneMap(hydratedItem);
            writeJsonFile(path.join(context.mapsDir, `${hydratedItem.id}.json`), standaloneMap);
            if (isActiveInlineMapId(hydratedItem.id)) {
                context.activeMapSnapshot[hydratedItem.id] = standaloneMap;
            }
        }

        return buildSlimManifestEntry(hydratedItem);
    });
}

function main() {
    const repoRoot = path.resolve(__dirname, '..');
    const mapsDir = path.join(repoRoot, 'maps');
    const sourceManifestPath = path.join(mapsDir, 'maps.json');
    const parityFixturePath = path.join(repoRoot, 'tests', 'fixtures', 'active-map-inline-snapshot.json');

    const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));
    const context = {
        mapsDir,
        activeMapSnapshot: {}
    };

    const slimManifest = migrateTree(sourceManifest, context);
    writeJsonFile(sourceManifestPath, slimManifest);
    writeJsonFile(parityFixturePath, context.activeMapSnapshot);

    const result = generateAtlasIndex({ repoRoot });
    console.log(`Slimmed manifest at ${path.relative(repoRoot, sourceManifestPath)}`);
    console.log(`Wrote active map parity fixture at ${path.relative(repoRoot, parityFixturePath)}`);
    console.log(`Regenerated ${path.relative(repoRoot, result.atlasIndexPath)} with ${result.searchEntryCount} search entries.`);
}

main();
