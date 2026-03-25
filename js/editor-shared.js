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

        mapToUpdate.scalePixels = parseInt(mapSettings.scalePixels, 10) || 3;
        mapToUpdate.scaleKilometers = parseFloat(mapSettings.scaleKilometers) || 1;
        mapToUpdate.blurb = mapSettings.blurb || '';
        if (mapSettings.name !== undefined) mapToUpdate.name = mapSettings.name || '';

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
        serializeEditorState
    };
}));
