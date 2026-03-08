#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const mapsDir = path.join(repoRoot, 'maps');
const generatedDir = path.join(mapsDir, 'generated');
const sourceIndexPath = path.join(mapsDir, 'maps.json');
const atlasIndexPath = path.join(mapsDir, 'atlas-index.json');

const rawIndex = JSON.parse(fs.readFileSync(sourceIndexPath, 'utf8'));
const writtenGeneratedFiles = new Set();
const searchEntries = [];
const seenSearchKeys = new Set();

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function stripHtml(value) {
    return String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function hasOwnContent(item) {
    return Boolean(
        item &&
        (
            item.width ||
            item.height ||
            item.imageUrl ||
            item.blurb ||
            item.filterGroups ||
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

function addSearchEntry(entry) {
    const key = `${entry.kind}:${entry.mapId}:${entry.routeId || ''}:${entry.itemId || entry.name}`;
    if (seenSearchKeys.has(key)) return;
    seenSearchKeys.add(key);
    searchEntries.push(entry);
}

function buildSearchEntriesForMap(item) {
    if (!item || item.status === 'coming-soon' || !item.id || !item.name) return;

    addSearchEntry({
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
        addSearchEntry({
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
        addSearchEntry({
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
        addSearchEntry({
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
        addSearchEntry({
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
            addSearchEntry({
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

function writeGeneratedMapData(item) {
    if (!item || !item.id || !hasOwnContent(item)) return '';
    const relativeUrl = `maps/generated/${item.id}.json`;
    const absolutePath = path.join(repoRoot, relativeUrl);
    if (!writtenGeneratedFiles.has(absolutePath)) {
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, `${JSON.stringify(item, null, 2)}\n`);
        writtenGeneratedFiles.add(absolutePath);
    }
    return relativeUrl;
}

function toManifestItem(item, origin) {
    const workingItem = cloneJson(item);
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
        if (workingItem[key] !== undefined) {
            manifestItem[key] = workingItem[key];
        }
    });

    if (origin.kind === 'inline') {
        const dataUrl = writeGeneratedMapData(workingItem);
        if (dataUrl) manifestItem.dataUrl = dataUrl;
    } else if (origin.kind === 'file') {
        manifestItem.dataUrl = origin.path;
    }

    if (Array.isArray(workingItem.children) && workingItem.children.length > 0) {
        manifestItem.children = workingItem.children.map((child) => {
            if (typeof child === 'string') {
                const childPath = `maps/${child}.json`;
                const childFullPath = path.join(repoRoot, childPath);
                const childData = JSON.parse(fs.readFileSync(childFullPath, 'utf8'));
                return toManifestItem(childData, { kind: 'file', path: childPath });
            }
            return toManifestItem(child, { kind: 'inline' });
        });
    }

    buildSearchEntriesForMap(workingItem);
    return manifestItem;
}

const atlasTree = rawIndex.map((item) => toManifestItem(item, { kind: 'inline' }));
const atlasIndex = {
    generatedAt: new Date().toISOString(),
    tree: atlasTree,
    searchIndex: searchEntries
};

fs.writeFileSync(atlasIndexPath, `${JSON.stringify(atlasIndex, null, 2)}\n`);
console.log(`Wrote ${path.relative(repoRoot, atlasIndexPath)} with ${searchEntries.length} search entries.`);
