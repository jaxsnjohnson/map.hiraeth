#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const { generateAtlasIndex } = require('./generate_atlas_index.js');

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function getManifestEntries(manifestDocument) {
    if (Array.isArray(manifestDocument)) return cloneJson(manifestDocument);
    if (manifestDocument && Array.isArray(manifestDocument.maps)) {
        return cloneJson(manifestDocument.maps);
    }
    return null;
}

function isFlatManifestEntry(entry) {
    if (!entry || typeof entry !== 'object') return false;
    return Object.prototype.hasOwnProperty.call(entry, 'parentId') ||
        Object.prototype.hasOwnProperty.call(entry, 'order');
}

function buildManifestTreeFromFlatEntries(entries) {
    if (!Array.isArray(entries)) return [];

    const normalizedEntries = cloneJson(entries)
        .filter((entry) => entry && typeof entry === 'object' && String(entry.id || '').trim());
    const knownIds = new Set(normalizedEntries.map((entry) => String(entry.id || '').trim()));
    const childrenByParentId = new Map();

    normalizedEntries.forEach((entry, index) => {
        const normalizedId = String(entry.id || '').trim();
        const rawParentId = String(entry.parentId || '').trim();
        const normalizedParentId = rawParentId && knownIds.has(rawParentId) ? rawParentId : '';
        if (!childrenByParentId.has(normalizedParentId)) {
            childrenByParentId.set(normalizedParentId, []);
        }
        childrenByParentId.get(normalizedParentId).push({ entry, index, normalizedId });
    });

    function buildNodes(parentId = '') {
        const groupedEntries = childrenByParentId.get(parentId) || [];
        groupedEntries.sort((left, right) => {
            const leftOrder = Number.isFinite(Number(left.entry.order))
                ? Number(left.entry.order)
                : Number.MAX_SAFE_INTEGER;
            const rightOrder = Number.isFinite(Number(right.entry.order))
                ? Number(right.entry.order)
                : Number.MAX_SAFE_INTEGER;
            if (leftOrder !== rightOrder) return leftOrder - rightOrder;
            return left.index - right.index;
        });

        return groupedEntries.map(({ entry, normalizedId }) => {
            const node = cloneJson(entry);
            delete node.parentId;
            delete node.order;

            const children = buildNodes(normalizedId);
            if (children.length > 0) node.children = children;
            else delete node.children;

            return node;
        });
    }

    return buildNodes('');
}

function buildManifestTreeFromDocument(manifestDocument) {
    const manifestEntries = getManifestEntries(manifestDocument);
    if (!Array.isArray(manifestEntries)) return [];
    if (!manifestEntries.some(isFlatManifestEntry)) {
        return manifestEntries;
    }
    return buildManifestTreeFromFlatEntries(manifestEntries);
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

function resolveMapJsonFilename(itemOrId) {
    const normalizedId = typeof itemOrId === 'string'
        ? String(itemOrId || '').trim()
        : String(itemOrId?.id || '').trim();
    if (normalizedId === 'main_continent') return 'Fair-Content.json';
    return normalizedId ? `${normalizedId}.json` : '';
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

function flattenManifestTree(items, parentId = '', collector = []) {
    if (!Array.isArray(items)) return collector;

    items.forEach((item, index) => {
        if (!item || typeof item !== 'object' || !item.id) return;

        const entry = cloneJson(item);
        const childItems = Array.isArray(entry.children) ? cloneJson(entry.children) : [];
        delete entry.children;

        entry.order = index;
        if (parentId) entry.parentId = parentId;
        else delete entry.parentId;

        collector.push(entry);
        flattenManifestTree(childItems, item.id, collector);
    });

    return collector;
}

function resolveOutputDataUrl(item) {
    const filename = resolveMapJsonFilename(item);
    return filename ? `maps/${filename}` : '';
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
            writeJsonFile(path.join(context.mapsDir, resolveMapJsonFilename(hydratedItem)), standaloneMap);
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

    const sourceManifestDocument = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));
    const sourceManifest = buildManifestTreeFromDocument(sourceManifestDocument);
    const context = {
        mapsDir,
        activeMapSnapshot: {}
    };

    const slimManifest = migrateTree(sourceManifest, context);
    const flattenedManifest = flattenManifestTree(slimManifest).map((entry) => {
        const nextEntry = cloneJson(entry);
        nextEntry.dataUrl = resolveOutputDataUrl(nextEntry);
        return nextEntry;
    });
    writeJsonFile(path.join(mapsDir, 'maps.json'), flattenedManifest);
    writeJsonFile(parityFixturePath, context.activeMapSnapshot);

    const result = generateAtlasIndex({ repoRoot });
    console.log(`Slimmed manifest at ${path.relative(repoRoot, path.join(mapsDir, 'maps.json'))}`);
    console.log(`Wrote active map parity fixture at ${path.relative(repoRoot, parityFixturePath)}`);
    console.log(`Regenerated ${path.relative(repoRoot, result.atlasIndexPath)} with ${result.searchEntryCount} search entries.`);
}

main();
