(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.MapEditorUtils = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function cloneJson(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeManifestTree(items) {
        if (!Array.isArray(items)) return [];
        return cloneJson(items);
    }

    function findMapRecursive(items, id) {
        if (!Array.isArray(items) || !id) return null;
        for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            if (item.id === id) return item;
            if (Array.isArray(item.children)) {
                const found = findMapRecursive(item.children, id);
                if (found) return found;
            }
        }
        return null;
    }

    function filterMapTree(items, query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return items;

        function filterRecursive(item) {
            if (!item || typeof item !== 'object') return null;
            const name = String(item.name || item.id || '').toLowerCase();
            const children = Array.isArray(item.children) ? item.children : [];
            const filteredChildren = children.map(filterRecursive).filter(Boolean);
            if (name.includes(q) || filteredChildren.length > 0) {
                return { ...item, children: filteredChildren };
            }
            return null;
        }

        return items.map(filterRecursive).filter(Boolean);
    }

    function normalizePoint(point) {
        const base = point && typeof point === 'object' ? cloneJson(point) : {};
        return {
            ...base,
            coords: Array.isArray(base.coords) && base.coords.length === 2
                ? base.coords.map((n) => Math.round(Number(n) || 0))
                : [0, 0],
            name: base.name || '',
            pronunciation: base.pronunciation || '',
            type: base.type || 'Unknown',
            description: base.description || '',
            summary: base.summary || '',
            wikiLink: base.wikiLink || '',
            linkedMapId: base.linkedMapId || '',
            properties: base.properties && typeof base.properties === 'object' ? cloneJson(base.properties) : {}
        };
    }

    function normalizeRegion(region) {
        const base = region && typeof region === 'object' ? cloneJson(region) : {};
        return {
            ...base,
            id: base.id || `region-${(base.name || 'untitled').toLowerCase().replace(/\s+/g, '-')}`,
            name: base.name || '',
            pronunciation: base.pronunciation || '',
            type: base.type || '',
            value: base.value || '',
            description: base.description || '',
            summary: base.summary || '',
            wikiLink: base.wikiLink || '',
            linkedMapId: base.linkedMapId || '',
            color: base.color || '#3388ff',
            fillColor: base.fillColor || '#3388ff',
            fillOpacity: base.fillOpacity ?? 0.2,
            coordinates: Array.isArray(base.coordinates)
                ? base.coordinates.map((coord) => [Math.round(Number(coord[0]) || 0), Math.round(Number(coord[1]) || 0)])
                : [],
            properties: base.properties && typeof base.properties === 'object' ? cloneJson(base.properties) : {}
        };
    }

    function normalizeLine(line) {
        const base = line && typeof line === 'object' ? cloneJson(line) : {};
        return {
            ...base,
            id: base.id || `line-${Math.random().toString(36).slice(2, 10)}`,
            name: base.name || '',
            pronunciation: base.pronunciation || '',
            type: base.type || '',
            color: base.color || '#808080',
            weight: Math.max(1, Math.round(Number(base.weight) || 3)),
            dashArray: base.dashArray || '',
            description: base.description || '',
            summary: base.summary || '',
            wikiLink: base.wikiLink || '',
            linkedMapId: base.linkedMapId || '',
            coordinates: Array.isArray(base.coordinates)
                ? base.coordinates.map((coord) => [Math.round(Number(coord[0]) || 0), Math.round(Number(coord[1]) || 0)])
                : [],
            properties: base.properties && typeof base.properties === 'object' ? cloneJson(base.properties) : {}
        };
    }

    function detectLineCollectionKey(mapData) {
        if (mapData && Object.prototype.hasOwnProperty.call(mapData, 'lines')) return 'lines';
        if (mapData && Object.prototype.hasOwnProperty.call(mapData, 'roads')) return 'roads';
        return 'lines';
    }

    function buildRegionFilterGroups(regions) {
        const filterGroups = { Regions: {} };
        const sortedRegions = Array.isArray(regions)
            ? [...regions].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
            : [];

        sortedRegions.forEach((region) => {
            if (!region || !region.type || !region.value) return;
            if (!filterGroups.Regions[region.type]) filterGroups.Regions[region.type] = [];
            if (!filterGroups.Regions[region.type].includes(region.value)) {
                filterGroups.Regions[region.type].push(region.value);
            }
        });

        Object.keys(filterGroups.Regions).forEach((type) => {
            filterGroups.Regions[type].sort((a, b) => String(a).localeCompare(String(b)));
        });

        return filterGroups;
    }

    function createUnavailableMapEntry(id, error = '') {
        const normalizedId = String(id || '').trim();
        return {
            id: normalizedId,
            name: normalizedId || 'Unavailable Map',
            status: 'coming-soon',
            error: String(error || `Could not resolve map "${normalizedId}".`)
        };
    }

    function buildDefaultMapDataUrl(id) {
        const normalizedId = String(id || '').trim();
        return normalizedId ? `maps/${normalizedId}.json` : '';
    }

    function hasInlineEditableMapPayload(mapData) {
        if (!mapData || typeof mapData !== 'object') return false;
        return Array.isArray(mapData.pointsOfInterest) ||
            Array.isArray(mapData.regions) ||
            Array.isArray(mapData.lines) ||
            Array.isArray(mapData.roads) ||
            typeof mapData.blurb === 'string' ||
            (mapData.filterGroups && typeof mapData.filterGroups === 'object');
    }

    async function resolveFileBackedMapDocument(mapData, options = {}) {
        if (!mapData || typeof mapData !== 'object') {
            throw new Error('Cannot resolve map document: invalid map node.');
        }

        const fallbackMap = cloneJson(mapData);
        if (hasInlineEditableMapPayload(fallbackMap)) {
            delete fallbackMap.dataUrl;
            return fallbackMap;
        }

        const loadJsonByPath = typeof options.loadJsonByPath === 'function'
            ? options.loadJsonByPath
            : null;
        const resolveDefaultDataUrl = typeof options.resolveDefaultDataUrl === 'function'
            ? options.resolveDefaultDataUrl
            : buildDefaultMapDataUrl;
        const mapId = String(fallbackMap.id || fallbackMap.name || 'unknown-map').trim();

        if (!loadJsonByPath) {
            throw new Error(`Could not resolve full map JSON for "${mapId}": no loader configured.`);
        }

        const candidatePaths = [];
        const explicitDataUrl = String(fallbackMap.dataUrl || '').trim();
        if (explicitDataUrl) candidatePaths.push(explicitDataUrl);

        const defaultDataUrl = String(resolveDefaultDataUrl(fallbackMap.id, fallbackMap) || '').trim();
        if (defaultDataUrl && !candidatePaths.includes(defaultDataUrl)) {
            candidatePaths.push(defaultDataUrl);
        }

        if (candidatePaths.length === 0) {
            throw new Error(`Could not resolve full map JSON for "${mapId}": no dataUrl or default path was available.`);
        }

        const failures = [];
        for (const candidatePath of candidatePaths) {
            try {
                const loadedMap = await loadJsonByPath(candidatePath, fallbackMap);
                if (!loadedMap || typeof loadedMap !== 'object') {
                    throw new Error('returned no JSON object');
                }

                const resolvedMap = {
                    ...fallbackMap,
                    ...cloneJson(loadedMap)
                };
                delete resolvedMap.dataUrl;
                return resolvedMap;
            } catch (error) {
                failures.push(`${candidatePath} (${error?.message || 'Unknown error.'})`);
            }
        }

        throw new Error(`Could not resolve full map JSON for "${mapId}": tried ${failures.join('; ')}`);
    }

    function normalizeRepoEntryPath(entry) {
        if (!entry || typeof entry !== 'object') return '';
        const rawPath = entry.path || entry.relativePath || entry.webkitRelativePath || entry.name || '';
        return String(rawPath)
            .replace(/\\/g, '/')
            .replace(/^\.?\//, '')
            .replace(/\/+/g, '/')
            .trim();
    }

    function buildRepoPathAliases(pathname) {
        const normalizedPath = String(pathname || '').trim();
        if (!normalizedPath) return [];

        const parts = normalizedPath.split('/').filter(Boolean);
        const aliases = [];
        for (let index = 0; index < parts.length; index += 1) {
            aliases.push(parts.slice(index).join('/'));
        }
        return aliases;
    }

    async function createRepoFileBackedMapSource(entries, options = {}) {
        if (!Array.isArray(entries) || entries.length === 0) {
            throw new Error('No files were provided for the repo folder.');
        }

        const readText = typeof options.readText === 'function'
            ? options.readText
            : async (entry) => {
                if (!entry || typeof entry !== 'object') {
                    throw new Error('Missing repo file entry.');
                }
                if (typeof entry.text === 'string') return entry.text;
                if (typeof entry.text === 'function') return entry.text();
                if (entry.file && typeof entry.file.text === 'function') return entry.file.text();
                throw new Error(`Could not read "${normalizeRepoEntryPath(entry)}".`);
            };

        const entryByAlias = new Map();
        const jsonCache = new Map();

        entries.forEach((entry) => {
            const normalizedPath = normalizeRepoEntryPath(entry);
            if (!normalizedPath) return;
            const normalizedEntry = {
                ...entry,
                path: normalizedPath
            };
            const aliases = buildRepoPathAliases(normalizedPath);
            aliases.forEach((alias) => {
                const existingEntry = entryByAlias.get(alias);
                if (!existingEntry || existingEntry.path.length > normalizedEntry.path.length) {
                    entryByAlias.set(alias, normalizedEntry);
                }
            });
        });

        function getFileEntry(relativePath) {
            const normalizedPath = String(relativePath || '')
                .replace(/\\/g, '/')
                .replace(/^\.?\//, '')
                .replace(/\/+/g, '/')
                .trim();
            if (!normalizedPath) {
                throw new Error('Missing required file path.');
            }
            const entry = entryByAlias.get(normalizedPath);
            if (!entry) {
                throw new Error(`Missing required file: ${normalizedPath}`);
            }
            return entry;
        }

        async function loadJsonByPath(relativePath) {
            const normalizedPath = String(relativePath || '')
                .replace(/\\/g, '/')
                .replace(/^\.?\//, '')
                .replace(/\/+/g, '/')
                .trim();
            if (!normalizedPath) {
                throw new Error('Missing JSON file path.');
            }

            if (!jsonCache.has(normalizedPath)) {
                jsonCache.set(normalizedPath, Promise.resolve().then(async () => {
                    const entry = getFileEntry(normalizedPath);
                    const rawText = await readText(entry);
                    try {
                        return JSON.parse(rawText);
                    } catch (error) {
                        throw new Error(`Invalid JSON in ${normalizedPath}: ${error.message}`);
                    }
                }));
            }

            return cloneJson(await jsonCache.get(normalizedPath));
        }

        const manifest = await loadJsonByPath('maps/maps.json');
        if (!Array.isArray(manifest)) {
            throw new Error('maps/maps.json must contain an array of map entries.');
        }

        let browseTree;
        try {
            const atlas = await loadJsonByPath('maps/atlas-index.json');
            browseTree = normalizeManifestTree(Array.isArray(atlas?.tree) ? atlas.tree : []);
        } catch (error) {
            browseTree = await hydrateFileBackedManifestTree(
                manifest,
                async (mapId) => loadJsonByPath(buildDefaultMapDataUrl(mapId)),
                {
                    resolveDataUrl: buildDefaultMapDataUrl
                }
            );
        }

        return {
            kind: 'repo-folder',
            baseManifest: normalizeManifestTree(manifest),
            browseTree,
            loadJsonByPath,
            resolveMapDocument: (mapData) => resolveFileBackedMapDocument(mapData, {
                loadJsonByPath,
                resolveDefaultDataUrl: buildDefaultMapDataUrl
            }),
            resolveImageEntry: (mapData) => {
                const imageUrl = String(mapData?.imageUrl || '').trim();
                if (!imageUrl) {
                    throw new Error(`Map "${String(mapData?.id || mapData?.name || 'unknown-map')}" is missing an imageUrl.`);
                }
                return getFileEntry(imageUrl);
            }
        };
    }

    async function hydrateFileBackedManifestTree(items, loadMapById, options = {}) {
        if (!Array.isArray(items) || typeof loadMapById !== 'function') return [];

        const cache = options.cache instanceof Map ? options.cache : new Map();
        const resolveDataUrl = typeof options.resolveDataUrl === 'function'
            ? options.resolveDataUrl
            : null;

        async function hydrateFromId(id) {
            const normalizedId = String(id || '').trim();
            if (!normalizedId) return null;

            if (!cache.has(normalizedId)) {
                cache.set(normalizedId, Promise.resolve()
                    .then(() => loadMapById(normalizedId))
                    .then((loadedMap) => {
                        if (!loadedMap || typeof loadedMap !== 'object') {
                            return createUnavailableMapEntry(normalizedId, `Map "${normalizedId}" returned no data.`);
                        }
                        return hydrateNode(loadedMap);
                    })
                    .catch((error) => createUnavailableMapEntry(normalizedId, error?.message || 'Unknown error.')));
            }

            return cloneJson(await cache.get(normalizedId));
        }

        async function hydrateNode(node) {
            if (!node || typeof node !== 'object') return null;

            const hydrated = cloneJson(node);
            if (resolveDataUrl && hydrated.id && hydrated.imageUrl && !hydrated.dataUrl) {
                hydrated.dataUrl = resolveDataUrl(hydrated.id);
            }

            if (Array.isArray(hydrated.children)) {
                const hydratedChildren = await Promise.all(hydrated.children.map((child) => {
                    if (typeof child === 'string') return hydrateFromId(child);
                    return hydrateNode(child);
                }));
                hydrated.children = hydratedChildren.filter(Boolean);
            }

            return hydrated;
        }

        const hydratedItems = await Promise.all(items.map((item) => {
            if (typeof item === 'string') return hydrateFromId(item);
            return hydrateNode(item);
        }));

        return hydratedItems.filter(Boolean);
    }

    function collectMapSelectionEntries(items) {
        const selections = [];
        const seenIds = new Set();

        function walk(nodes) {
            if (!Array.isArray(nodes)) return;
            nodes.forEach((item) => {
                if (!item || typeof item !== 'object') return;

                const normalizedId = String(item.id || '').trim();
                const label = String(item.name || normalizedId || '').trim();
                const isLoadable = Boolean(
                    normalizedId &&
                    label &&
                    item.imageUrl &&
                    item.status !== 'coming-soon' &&
                    !item.error
                );
                const isUnavailablePlaceholder = Boolean(
                    normalizedId &&
                    (item.status === 'coming-soon' || item.error)
                );

                if ((isLoadable || isUnavailablePlaceholder) && !seenIds.has(normalizedId)) {
                    seenIds.add(normalizedId);
                    selections.push({
                        id: normalizedId,
                        name: label || normalizedId,
                        disabled: !isLoadable,
                        title: String(item.error || (item.status === 'coming-soon' ? 'Unavailable' : ''))
                    });
                }

                if (Array.isArray(item.children)) {
                    walk(item.children);
                }
            });
        }

        walk(items);
        return selections;
    }

    function applyMapSettings(mapToUpdate, mapSettings = {}) {
        if (!mapToUpdate || typeof mapToUpdate !== 'object') return;
        mapToUpdate.scalePixels = parseInt(mapSettings.scalePixels, 10) || 3;
        mapToUpdate.scaleKilometers = parseFloat(mapSettings.scaleKilometers) || 1;
        mapToUpdate.blurb = mapSettings.blurb || '';
        if (mapSettings.name !== undefined) mapToUpdate.name = mapSettings.name || '';
    }

    function serializeEditorState(options) {
        const {
            masterMapData,
            currentMapId,
            collectedPoints,
            collectedRegions,
            collectedLines,
            mapSettings = {},
            lineCollectionKey = 'lines',
            selectedMapOnly = false
        } = options || {};

        if (!currentMapId) return null;

        const updatedMasterData = Array.isArray(masterMapData)
            ? cloneJson(masterMapData)
            : [];
        const mapToUpdate = findMapRecursive(updatedMasterData, currentMapId);
        if (!mapToUpdate) return null;

        applyMapSettings(mapToUpdate, mapSettings);

        const sortedPoints = (Array.isArray(collectedPoints) ? collectedPoints : [])
            .map(normalizePoint)
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        const sortedRegions = (Array.isArray(collectedRegions) ? collectedRegions : [])
            .map(normalizeRegion)
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        const sortedLines = (Array.isArray(collectedLines) ? collectedLines : [])
            .map(normalizeLine)
            .sort((a, b) => String(a.name || a.id || '').localeCompare(String(b.name || b.id || '')));

        mapToUpdate.pointsOfInterest = sortedPoints.map((point) => ({
            ...point,
            coords: point.coords,
            properties: point.properties || {}
        }));

        mapToUpdate.regions = sortedRegions.map((region) => ({
            ...region,
            coordinates: region.coordinates,
            properties: region.properties || {}
        }));

        mapToUpdate.filterGroups = buildRegionFilterGroups(sortedRegions);

        mapToUpdate[lineCollectionKey] = sortedLines.map((line) => ({
            ...line,
            coordinates: line.coordinates,
            properties: line.properties || {}
        }));
        delete mapToUpdate[lineCollectionKey === 'roads' ? 'lines' : 'roads'];

        return selectedMapOnly ? mapToUpdate : updatedMasterData;
    }

    function serializeManifestState(options) {
        const {
            masterMapData,
            currentMapId,
            mapSettings = {}
        } = options || {};

        if (!currentMapId) return null;

        const updatedMasterData = Array.isArray(masterMapData)
            ? cloneJson(masterMapData)
            : [];
        const mapToUpdate = findMapRecursive(updatedMasterData, currentMapId);
        if (mapToUpdate) {
            applyMapSettings(mapToUpdate, mapSettings);
        }
        return updatedMasterData;
    }

    function buildFeatureSelectionKey(mode, item) {
        if (!item || !mode) return '';
        const identity = mode === 'lines'
            ? String(item.id || item.name || '')
            : String(item.name || item.id || '');
        return JSON.stringify([mode, identity]);
    }

    function resolveFeatureIndexFromSelection(mode, items, selectionKey) {
        if (!mode || !selectionKey || !Array.isArray(items)) return -1;
        let parsed;
        try {
            parsed = JSON.parse(selectionKey);
        } catch (error) {
            return -1;
        }
        if (!Array.isArray(parsed) || parsed.length !== 2 || parsed[0] !== mode) return -1;
        const identity = String(parsed[1] || '');
        if (!identity) return -1;
        return items.findIndex((item) => {
            if (!item) return false;
            if (mode === 'lines') return String(item.id || item.name || '') === identity;
            return String(item.name || item.id || '') === identity;
        });
    }

    return {
        buildFeatureSelectionKey,
        buildRegionFilterGroups,
        cloneJson,
        detectLineCollectionKey,
        filterMapTree,
        findMapRecursive,
        normalizeLine,
        normalizeManifestTree,
        normalizePoint,
        normalizeRegion,
        resolveFeatureIndexFromSelection,
        createUnavailableMapEntry,
        createRepoFileBackedMapSource,
        hydrateFileBackedManifestTree,
        collectMapSelectionEntries,
        resolveFileBackedMapDocument,
        serializeEditorState,
        serializeManifestState
    };
}));
