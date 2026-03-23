#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function stripHtml(value) {
    return String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function hasInlinePayload(item) {
    return Boolean(
        item &&
        (
            item.blurb ||
            item.filterGroups ||
            item.gmNotes ||
            item.gmOverview ||
            (Array.isArray(item.pointsOfInterest) && item.pointsOfInterest.length) ||
            (Array.isArray(item.points) && item.points.length) ||
            (Array.isArray(item.regions) && item.regions.length) ||
            (Array.isArray(item.roads) && item.roads.length) ||
            (Array.isArray(item.lines) && item.lines.length) ||
            (Array.isArray(item.routes) && item.routes.length) ||
            (Array.isArray(item.encounterTables) && item.encounterTables.length)
        )
    );
}

function buildGeneratorContext(repoRoot) {
    const mapsDir = path.join(repoRoot, 'maps');
    return {
        repoRoot,
        mapsDir,
        generatedDir: path.join(mapsDir, 'generated'),
        sourceIndexPath: path.join(mapsDir, 'maps.json'),
        atlasIndexPath: path.join(mapsDir, 'atlas-index.json'),
        writtenGeneratedFiles: new Set(),
        searchEntries: [],
        seenSearchKeys: new Set()
    };
}

function readJsonFile(fullPath) {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function addSearchEntry(context, entry) {
    const key = `${entry.kind}:${entry.mapId}:${entry.routeId || ''}:${entry.itemId || entry.name}`;
    if (context.seenSearchKeys.has(key)) return;
    context.seenSearchKeys.add(key);
    context.searchEntries.push(entry);
}

function buildSearchEntriesForMap(context, item) {
    if (!item || item.status === 'coming-soon' || !item.id || !item.name) return;

    addSearchEntry(context, {
        kind: 'map',
        id: `map:${item.id}`,
        mapId: item.id,
        mapName: item.name,
        name: item.name,
        summary: stripHtml(item.blurb || ''),
        description: '',
        typeLabel: 'Map',
        visibility: String(item.visibility || 'public').toLowerCase()
    });

    const points = Array.isArray(item.pointsOfInterest) ? item.pointsOfInterest :
        (Array.isArray(item.points) ? item.points : []);
    points.forEach((point, index) => {
        if (!point || !point.name) return;
        addSearchEntry(context, {
            kind: 'poi',
            id: `poi:${item.id}:${point.id || index}`,
            itemId: point.id || point.name,
            mapId: item.id,
            mapName: item.name,
            name: point.name,
            summary: stripHtml(point.summary || ''),
            description: stripHtml(point.description || ''),
            typeLabel: point.type || 'POI',
            visibility: String(point.visibility || 'public').toLowerCase()
        });
    });

    const regions = Array.isArray(item.regions) ? item.regions : [];
    regions.forEach((region, index) => {
        if (!region || !region.name) return;
        addSearchEntry(context, {
            kind: 'region',
            id: `region:${item.id}:${region.id || index}`,
            itemId: region.id || region.name,
            mapId: item.id,
            mapName: item.name,
            name: region.name,
            summary: stripHtml(region.summary || ''),
            description: stripHtml(region.description || ''),
            typeLabel: region.value || region.type || 'Region',
            visibility: String(region.visibility || 'public').toLowerCase()
        });
    });

    const lines = [
        ...(Array.isArray(item.roads) ? item.roads : []),
        ...(Array.isArray(item.lines) ? item.lines : [])
    ];
    lines.forEach((line, index) => {
        const lineName = line && (line.name || line.type);
        if (!lineName) return;
        addSearchEntry(context, {
            kind: 'line',
            id: `line:${item.id}:${line.id || index}`,
            itemId: line.id || lineName,
            mapId: item.id,
            mapName: item.name,
            name: lineName,
            summary: stripHtml(line.summary || ''),
            description: stripHtml(line.description || ''),
            typeLabel: line.type || 'Line',
            visibility: String(line.visibility || 'public').toLowerCase()
        });
    });

    const routes = Array.isArray(item.routes) ? item.routes : [];
    routes.forEach((route, routeIndex) => {
        if (!route || !route.id) return;
        addSearchEntry(context, {
            kind: 'route',
            id: `route:${item.id}:${route.id}`,
            itemId: route.id,
            routeId: route.id,
            mapId: item.id,
            mapName: item.name,
            name: route.name || route.id,
            summary: stripHtml(route.summary || ''),
            description: '',
            typeLabel: 'Route',
            visibility: String(route.visibility || 'public').toLowerCase()
        });

        (Array.isArray(route.steps) ? route.steps : []).forEach((step, stepIndex) => {
            if (!step || !step.id) return;
            addSearchEntry(context, {
                kind: 'step',
                id: `step:${item.id}:${route.id}:${step.id}`,
                itemId: step.id,
                routeId: route.id,
                mapId: item.id,
                mapName: item.name,
                name: step.title || step.id || `Step ${stepIndex + 1}`,
                summary: stripHtml(step.body || ''),
                description: '',
                typeLabel: 'Step',
                visibility: String(step.visibility || route.visibility || 'public').toLowerCase()
            });
        });
    });
}

function writeGeneratedMapData(context, item) {
    if (!item || !item.id || !hasInlinePayload(item)) return '';
    const relativeUrl = `maps/generated/${item.id}.json`;
    const absolutePath = path.join(context.repoRoot, relativeUrl);
    if (!context.writtenGeneratedFiles.has(absolutePath)) {
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, `${JSON.stringify(item, null, 2)}\n`);
        context.writtenGeneratedFiles.add(absolutePath);
    }
    return relativeUrl;
}

function mergeMapDefinitions(indexItem, sourceItem) {
    const merged = cloneJson(sourceItem);
    const overlayKeys = [
        'type',
        'id',
        'name',
        'status',
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
        'visibility',
        'blurb'
    ];

    overlayKeys.forEach((key) => {
        if (indexItem[key] !== undefined) {
            merged[key] = cloneJson(indexItem[key]);
        }
    });

    return merged;
}

function loadFileBackedMap(context, relativePath, indexItem) {
    const normalizedPath = String(relativePath || '').trim();
    const absolutePath = path.join(context.repoRoot, normalizedPath);
    const sourceItem = readJsonFile(absolutePath);
    return {
        sourceItem: mergeMapDefinitions(indexItem, sourceItem),
        dataUrl: normalizedPath
    };
}

function resolveMapSource(context, item, origin) {
    if (origin.kind === 'file') {
        return {
            sourceItem: cloneJson(item),
            dataUrl: origin.path
        };
    }

    if (Array.isArray(item.children) && item.children.length > 0) {
        return {
            sourceItem: cloneJson(item),
            dataUrl: writeGeneratedMapData(context, item)
        };
    }

    const explicitDataUrl = String(item.dataUrl || '').trim();
    if (explicitDataUrl) {
        return loadFileBackedMap(context, explicitDataUrl, item);
    }

    if (hasInlinePayload(item)) {
        return {
            sourceItem: cloneJson(item),
            dataUrl: writeGeneratedMapData(context, item)
        };
    }

    if (item.id) {
        return loadFileBackedMap(context, `maps/${item.id}.json`, item);
    }

    return {
        sourceItem: cloneJson(item),
        dataUrl: ''
    };
}

function toManifestItem(context, item, origin) {
    const { sourceItem, dataUrl } = resolveMapSource(context, item, origin);
    const manifestItem = {};
    const keysToCopy = [
        'type',
        'id',
        'name',
        'status',
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
        'visibility'
    ];

    keysToCopy.forEach((key) => {
        if (sourceItem[key] !== undefined) {
            manifestItem[key] = sourceItem[key];
        }
    });

    if (dataUrl) {
        manifestItem.dataUrl = dataUrl;
    }

    if (Array.isArray(sourceItem.children) && sourceItem.children.length > 0) {
        manifestItem.children = sourceItem.children.map((child) => {
            if (typeof child === 'string') {
                const childPath = `maps/${child}.json`;
                const childData = readJsonFile(path.join(context.repoRoot, childPath));
                return toManifestItem(context, childData, { kind: 'file', path: childPath });
            }
            return toManifestItem(context, child, { kind: 'inline' });
        });
    }

    buildSearchEntriesForMap(context, sourceItem);
    return manifestItem;
}

function generateAtlasIndex(options = {}) {
    const repoRoot = path.resolve(options.repoRoot || path.resolve(__dirname, '..'));
    const context = buildGeneratorContext(repoRoot);
    const rawIndex = readJsonFile(context.sourceIndexPath);
    const atlasTree = rawIndex.map((item) => toManifestItem(context, item, { kind: 'inline' }));
    const atlasIndex = {
        generatedAt: new Date().toISOString(),
        tree: atlasTree,
        searchIndex: context.searchEntries
    };

    fs.writeFileSync(context.atlasIndexPath, `${JSON.stringify(atlasIndex, null, 2)}\n`);
    return {
        atlasIndex,
        atlasIndexPath: context.atlasIndexPath,
        searchEntryCount: context.searchEntries.length
    };
}

if (require.main === module) {
    const result = generateAtlasIndex();
    const repoRoot = path.resolve(__dirname, '..');
    console.log(`Wrote ${path.relative(repoRoot, result.atlasIndexPath)} with ${result.searchEntryCount} search entries.`);
}

module.exports = {
    generateAtlasIndex
};
