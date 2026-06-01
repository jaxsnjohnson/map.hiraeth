(function () {
    const utils = window.MapEditorUtils;
    const sharedUtils = window.SharedUtils;

    if (!utils || !sharedUtils || typeof L === 'undefined') {
        console.error('Map editor prerequisites are missing.');
        return;
    }

    const state = {
        atlasTree: [],
        currentMapId: '',
        currentMap: null,
        currentBounds: null,
        lineCollectionKey: 'lines',
        drawMode: '',
        draftCoordinates: [],
        selectedFeature: null,
        featureListState: {
            type: 'points',
            searchQuery: '',
            expanded: false,
            defaultLimit: 5
        },
        expandedFolderIds: new Set(),
        treeSearch: '',
        map: null,
        imageLayer: null,
        underlayLayer: null,
        pointLayer: null,
        regionLayer: null,
        lineLayer: null,
        vertexLayer: null,
        draftLayer: null
    };

    const dom = {
        appShell: document.getElementById('map-editor-app'),
        atlasTree: document.getElementById('editor-atlas-tree'),
        treeSearch: document.getElementById('editor-tree-search'),
        reloadButton: document.getElementById('reload-editor-btn'),
        selectionStatus: document.getElementById('editor-selection-status'),
        mapEmptyState: document.getElementById('editor-map-empty-state'),
        mapEmptyTitle: document.getElementById('editor-map-empty-title'),
        mapEmptyCopy: document.getElementById('editor-map-empty-copy'),
        mapEmptyDetail: document.getElementById('editor-map-empty-detail'),
        exportStatus: document.getElementById('editor-export-status'),
        currentMapId: document.getElementById('editor-current-map-id'),
        featureSummary: document.getElementById('editor-feature-summary'),
        selectedFeatureChip: document.getElementById('editor-selected-feature-chip'),
        mapSettingsForm: document.getElementById('map-settings-form'),
        featureForm: document.getElementById('editor-feature-form'),
        featureFormEmpty: document.getElementById('editor-feature-inspector-empty'),
        featureTypeSelect: document.getElementById('editor-feature-type-select'),
        featureSearchInput: document.getElementById('editor-feature-search'),
        unifiedFeatureList: document.getElementById('editor-unified-feature-list'),
        featureShowMoreButton: document.getElementById('editor-feature-show-more-btn'),
        addPoiButton: document.getElementById('editor-add-poi-btn'),
        addRegionButton: document.getElementById('editor-add-region-btn'),
        addLineButton: document.getElementById('editor-add-line-btn'),
        finishDrawButton: document.getElementById('editor-finish-draw-btn'),
        cancelDrawButton: document.getElementById('editor-cancel-draw-btn'),
        deleteSelectionButton: document.getElementById('editor-delete-selection-btn'),
        resetViewButton: document.getElementById('editor-reset-view-btn'),
        exportCurrentMapButton: document.getElementById('export-current-map-btn'),
        exportAtlasStructureButton: document.getElementById('export-atlas-structure-btn'),
        chooseMapButton: document.getElementById('editor-choose-map-btn'),
        mapSettingsInputs: {
            name: document.getElementById('map-name-input'),
            type: document.getElementById('map-type-input'),
            status: document.getElementById('map-status-input'),
            visibility: document.getElementById('map-visibility-input'),
            group: document.getElementById('map-group-input'),
            dataUrl: document.getElementById('map-data-url-input'),
            imageUrl: document.getElementById('map-image-url-input'),
            mobileImageUrl: document.getElementById('map-mobile-image-url-input'),
            smallImageUrl: document.getElementById('map-small-image-url-input'),
            width: document.getElementById('map-width-input'),
            height: document.getElementById('map-height-input'),
            scalePixels: document.getElementById('map-scale-pixels-input'),
            scaleKilometers: document.getElementById('map-scale-kilometers-input'),
            scaleUnitName: document.getElementById('map-scale-unit-input'),
            backgroundColor: document.getElementById('map-background-color-input'),
            atmosphere: document.getElementById('map-atmosphere-input'),
            selectorDescription: document.getElementById('map-selector-description-input'),
            latNorth: document.getElementById('map-lat-north-input'),
            latSouth: document.getElementById('map-lat-south-input'),
            latEast: document.getElementById('map-lat-east-input'),
            latWest: document.getElementById('map-lat-west-input'),
            blurb: document.getElementById('map-blurb-input'),
            parentIdSelect: document.getElementById('map-parent-id-select'),
            order: document.getElementById('map-order-input')
        }
    };

    function roundCoordinate(value) {
        return Math.round(Number(value) || 0);
    }

    function roundLatLng(latlng) {
        return [roundCoordinate(latlng.lat), roundCoordinate(latlng.lng)];
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/`/g, '&#96;');
    }

    function getCurrentPoints() {
        if (!state.currentMap) return [];
        if (!Array.isArray(state.currentMap.pointsOfInterest)) {
            state.currentMap.pointsOfInterest = [];
        }
        return state.currentMap.pointsOfInterest;
    }

    function getCurrentRegions() {
        if (!state.currentMap) return [];
        if (!Array.isArray(state.currentMap.regions)) {
            state.currentMap.regions = [];
        }
        return state.currentMap.regions;
    }

    function getCurrentLines() {
        if (!state.currentMap) return [];
        if (!Array.isArray(state.currentMap[state.lineCollectionKey])) {
            state.currentMap[state.lineCollectionKey] = [];
        }
        return state.currentMap[state.lineCollectionKey];
    }

    const fetchJsonAsset = sharedUtils.fetchJsonAsset;

    function findNodeLocation(items, id, parentId = '') {
        if (!Array.isArray(items)) return null;
        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            if (!item || typeof item !== 'object') continue;
            if (item.id === id) {
                return {
                    node: item,
                    index,
                    parentId,
                    siblings: items
                };
            }
            const nestedLocation = findNodeLocation(item.children, id, item.id);
            if (nestedLocation) return nestedLocation;
        }
        return null;
    }

    function collectDescendantIds(node, collector = new Set()) {
        if (!node || typeof node !== 'object' || !Array.isArray(node.children)) return collector;
        node.children.forEach((child) => {
            if (!child || typeof child !== 'object' || !child.id) return;
            collector.add(child.id);
            collectDescendantIds(child, collector);
        });
        return collector;
    }

    function replaceNodeById(items, id, nextNode) {
        if (!Array.isArray(items)) return [];
        return items.map((item) => {
            if (!item || typeof item !== 'object') return item;
            if (item.id === id) return nextNode;
            if (Array.isArray(item.children)) {
                return {
                    ...item,
                    children: replaceNodeById(item.children, id, nextNode)
                };
            }
            return item;
        });
    }

    function moveNodeInTree(items, nodeId, nextParentId, nextOrder) {
        const clonedTree = utils.cloneJson(items);
        const location = findNodeLocation(clonedTree, nodeId);
        if (!location || !location.node) return clonedTree;

        const descendantIds = collectDescendantIds(location.node);
        const normalizedParentId = String(nextParentId || '').trim();
        if (normalizedParentId && (normalizedParentId === nodeId || descendantIds.has(normalizedParentId))) {
            throw new Error('A map cannot be moved inside itself or one of its descendants.');
        }

        const removedNode = location.siblings.splice(location.index, 1)[0];
        let targetSiblings = clonedTree;

        if (normalizedParentId) {
            const nextParentNode = utils.findMapRecursive(clonedTree, normalizedParentId);
            if (!nextParentNode) {
                throw new Error(`Could not find parent map "${normalizedParentId}".`);
            }
            if (!Array.isArray(nextParentNode.children)) {
                nextParentNode.children = [];
            }
            targetSiblings = nextParentNode.children;
        }

        let insertionIndex = Number.isFinite(Number(nextOrder))
            ? Number(nextOrder)
            : targetSiblings.length;
        insertionIndex = Math.max(0, Math.min(targetSiblings.length, insertionIndex));
        targetSiblings.splice(insertionIndex, 0, removedNode);

        return clonedTree;
    }

    function canRenderMap(mapInfo) {
        return Boolean(
            mapInfo &&
            Number.isFinite(Number(mapInfo.width)) &&
            Number.isFinite(Number(mapInfo.height)) &&
            String(mapInfo.imageUrl || '').trim()
        );
    }

    function getMapPresetGroupLabel(item) {
        return String(item?.group || item?.category || '').trim();
    }

    function readMapSettingsForm() {
        const inputs = dom.mapSettingsInputs;
        return {
            name: inputs.name.value,
            type: inputs.type.value,
            status: inputs.status.value,
            visibility: inputs.visibility.value,
            group: inputs.group.value,
            dataUrl: inputs.dataUrl.value,
            imageUrl: inputs.imageUrl.value,
            mobileImageUrl: inputs.mobileImageUrl.value,
            smallImageUrl: inputs.smallImageUrl.value,
            width: inputs.width.value,
            height: inputs.height.value,
            scalePixels: inputs.scalePixels.value,
            scaleKilometers: inputs.scaleKilometers.value,
            scaleUnitName: inputs.scaleUnitName.value,
            backgroundColor: inputs.backgroundColor.value,
            atmosphere: inputs.atmosphere.value,
            selectorDescription: inputs.selectorDescription.value,
            latLonBounds: {
                north: inputs.latNorth.value,
                south: inputs.latSouth.value,
                east: inputs.latEast.value,
                west: inputs.latWest.value
            }
        };
    }

    function setSelectionStatus(message) {
        dom.selectionStatus.textContent = message;
    }

    function setExportStatus(message, isError = false) {
        dom.exportStatus.textContent = message;
        dom.exportStatus.style.color = isError ? '#dc2626' : '';
    }

    function setMapEmptyState({ hidden, title = '', copy = '', detail = '' }) {
        dom.mapEmptyState.hidden = hidden;

        if (!hidden) {
            dom.mapEmptyTitle.textContent = title || 'No Renderable Map Selected';
            dom.mapEmptyCopy.textContent = copy || 'Select a map with image data to edit points, regions, and lines.';
        }

        const normalizedDetail = String(detail || '').trim();
        dom.mapEmptyDetail.hidden = !normalizedDetail;
        dom.mapEmptyDetail.textContent = normalizedDetail;
    }

    function getMapContainerSize() {
        if (!state.map) return { width: 0, height: 0 };
        const container = state.map.getContainer();
        if (!container) return { width: 0, height: 0 };
        const rect = container.getBoundingClientRect();
        return {
            width: rect.width || 0,
            height: rect.height || 0
        };
    }

    function queueMapViewportReset() {
        if (!state.map || !state.currentBounds) return;
        let attempts = 0;
        const resetViewport = () => {
            if (!state.map || !state.currentBounds) return;
            const { width, height } = getMapContainerSize();
            if ((width < 16 || height < 16) && attempts < 8) {
                attempts += 1;
                requestAnimationFrame(resetViewport);
                return;
            }
            state.map.invalidateSize(false);
            try {
                state.map.fitBounds(state.currentBounds, { padding: [20, 20] });
            } catch (error) {
                console.error('Map editor viewport reset failed.', {
                    bounds: state.currentBounds,
                    width,
                    height,
                    error
                });
                if (Array.isArray(state.currentBounds) && state.currentBounds[1]) {
                    const mapHeight = Number(state.currentBounds[1][0]) || 0;
                    const mapWidth = Number(state.currentBounds[1][1]) || 0;
                    state.map.setView([mapHeight / 2, mapWidth / 2], -2, { animate: false });
                }
            }
        };
        requestAnimationFrame(resetViewport);
    }

    function clearMapVisualLayers() {
        if (state.imageLayer) {
            state.map.removeLayer(state.imageLayer);
            state.imageLayer = null;
        }
        if (state.underlayLayer) {
            state.map.removeLayer(state.underlayLayer);
            state.underlayLayer = null;
        }
    }

    function getCurrentFeatureCollection(mode) {
        if (mode === 'points') return getCurrentPoints();
        if (mode === 'regions') return getCurrentRegions();
        if (mode === 'lines') return getCurrentLines();
        return [];
    }

    function getSelectedFeature() {
        if (!state.selectedFeature) return null;
        const collection = getCurrentFeatureCollection(state.selectedFeature.mode);
        return collection[state.selectedFeature.index] || null;
    }

    function clearDrawMode() {
        state.drawMode = '';
        state.draftCoordinates = [];
        renderDraftGeometry();
        syncToolbarState();
    }

    function selectFeature(mode, index) {
        const collection = getCurrentFeatureCollection(mode);
        if (!collection[index]) {
            state.selectedFeature = null;
        } else {
            state.selectedFeature = { mode, index };
            if (mode === 'points') {
                setSelectionStatus('POI selected. Drag the marker on the map to move it.');
            } else {
                setSelectionStatus('Geometry selected. Drag the orange vertex handles to reshape it.');
            }
        }
        renderFeatureLists();
        renderFeatureInspector();
        renderMapLayers(false);
        syncToolbarState();
    }

    function deselectFeature() {
        state.selectedFeature = null;
        renderFeatureLists();
        renderFeatureInspector();
        renderMapLayers(false);
        syncToolbarState();
    }

    function syncToolbarState() {
        const canEditGeometry = canRenderMap(state.currentMap);
        dom.addPoiButton.disabled = !canEditGeometry;
        dom.addRegionButton.disabled = !canEditGeometry;
        dom.addLineButton.disabled = !canEditGeometry;
        dom.resetViewButton.disabled = !canEditGeometry;
        dom.deleteSelectionButton.disabled = !state.selectedFeature;
        dom.finishDrawButton.hidden = !state.drawMode;
        dom.cancelDrawButton.hidden = !state.drawMode;
        dom.exportCurrentMapButton.disabled = !canRenderMap(state.currentMap);
    }

    function buildTreeSearchItems() {
        if (!state.treeSearch) return state.atlasTree;
        return utils.filterMapTree(state.atlasTree, state.treeSearch);
    }

    function toggleFolder(id) {
        if (state.expandedFolderIds.has(id)) {
            state.expandedFolderIds.delete(id);
        } else {
            state.expandedFolderIds.add(id);
        }
        renderAtlasTree();
    }

    function renderAtlasTree() {
        const visibleTree = buildTreeSearchItems();
        dom.atlasTree.innerHTML = '';

        if (!Array.isArray(visibleTree) || visibleTree.length === 0) {
            dom.atlasTree.innerHTML = '<p class="map-editor-placeholder">No maps match the current search.</p>';
            return;
        }

        function renderNodes(items) {
            const list = document.createElement('ul');
            list.className = 'map-editor-tree-list';
            const sourceItems = Array.isArray(items) ? items : [];
            const hasGroupedItems = sourceItems.some((item) => getMapPresetGroupLabel(item));

            function createTreeNode(item) {
                if (!item || typeof item !== 'object') return;
                const row = document.createElement('li');
                const header = document.createElement('div');
                header.className = 'map-editor-tree-row';

                const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                const toggleButton = document.createElement('button');
                toggleButton.type = 'button';
                toggleButton.className = 'map-editor-tree-toggle';
                toggleButton.textContent = hasChildren
                    ? (state.expandedFolderIds.has(item.id) ? 'v' : '>')
                    : '-';
                toggleButton.disabled = !hasChildren;
                toggleButton.addEventListener('click', () => toggleFolder(item.id));
                header.appendChild(toggleButton);

                const selectButton = document.createElement('button');
                selectButton.type = 'button';
                selectButton.className = 'map-editor-tree-item';
                selectButton.setAttribute('aria-label', `Select map: ${item.name || item.id}`);
                if (item.id === state.currentMapId) {
                    selectButton.classList.add('active');
                }
                const strongTag = document.createElement('strong');
                strongTag.textContent = item.name || item.id;
                selectButton.appendChild(strongTag);
                selectButton.addEventListener('click', () => {
                    selectMap(item.id).catch((error) => {
                        console.error(error);
                        setSelectionStatus(error.message || 'Could not select the map.');
                    });
                });
                header.appendChild(selectButton);

                row.appendChild(header);

                if (hasChildren && state.expandedFolderIds.has(item.id)) {
                    row.appendChild(renderNodes(item.children));
                }

                return row;
            }

            if (!hasGroupedItems) {
                sourceItems.forEach((item) => {
                    const row = createTreeNode(item);
                    if (row) list.appendChild(row);
                });
                return list;
            }

            const renderedGroups = new Set();
            sourceItems.forEach((item) => {
                const groupLabel = getMapPresetGroupLabel(item);
                if (!groupLabel) {
                    const row = createTreeNode(item);
                    if (row) list.appendChild(row);
                    return;
                }
                if (renderedGroups.has(groupLabel)) return;
                renderedGroups.add(groupLabel);

                const groupRow = document.createElement('li');
                groupRow.className = 'map-editor-tree-group';

                const groupHeader = document.createElement('div');
                groupHeader.className = 'map-editor-tree-group-header';
                groupHeader.textContent = groupLabel;
                groupRow.appendChild(groupHeader);

                const groupList = document.createElement('ul');
                groupList.className = 'map-editor-tree-list map-editor-tree-group-list';
                sourceItems
                    .filter((candidate) => getMapPresetGroupLabel(candidate) === groupLabel)
                    .forEach((candidate) => {
                        const row = createTreeNode(candidate);
                        if (row) groupList.appendChild(row);
                    });

                groupRow.appendChild(groupList);
                list.appendChild(groupRow);
            });

            return list;
        }

        dom.atlasTree.appendChild(renderNodes(visibleTree));
    }

    function getFeatureSummaryLabel() {
        const points = getCurrentPoints().length;
        const regions = getCurrentRegions().length;
        const lines = getCurrentLines().length;
        return `${points} POIs, ${regions} regions, ${lines} lines`;
    }

    function renderFeatureLists() {
        const { type, searchQuery, expanded, defaultLimit } = state.featureListState;
        dom.featureTypeSelect.value = type;
        dom.unifiedFeatureList.innerHTML = '';
        dom.featureShowMoreButton.hidden = true;

        let items = [];
        if (type === 'points') items = getCurrentPoints();
        else if (type === 'regions') items = getCurrentRegions();
        else if (type === 'lines') items = getCurrentLines();

        if (!Array.isArray(items) || items.length === 0) {
            dom.unifiedFeatureList.innerHTML = '<p class="map-editor-placeholder">No entries yet.</p>';
            dom.featureSummary.textContent = getFeatureSummaryLabel();
            return;
        }

        const query = searchQuery.toLowerCase();
        const filteredItems = items.map((item, index) => ({ item, index })).filter(({ item, index }) => {
            if (!query) return true;
            const label = item.name || item.id || `${type.slice(0, -1)} ${index + 1}`;
            const meta = type === 'points' ? (item.type || 'Point') : (type === 'regions' ? (item.value || item.type || 'Region') : (item.type || 'Line'));
            return label.toLowerCase().includes(query) || meta.toLowerCase().includes(query);
        });

        if (filteredItems.length === 0) {
            dom.unifiedFeatureList.innerHTML = '<p class="map-editor-placeholder">No matching entries found.</p>';
            dom.featureSummary.textContent = getFeatureSummaryLabel();
            return;
        }

        const limit = expanded ? filteredItems.length : defaultLimit;
        const visibleItems = filteredItems.slice(0, limit);

        visibleItems.forEach(({ item, index }) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'map-editor-feature-entry';
            if (state.selectedFeature && state.selectedFeature.mode === type && state.selectedFeature.index === index) {
                button.classList.add('active');
            }
            const label = item.name || item.id || `${type.slice(0, -1)} ${index + 1}`;
            const meta = type === 'points'
                ? `${item.type || 'Point'} - ${Array.isArray(item.coords) ? item.coords.join(', ') : 'No coords'}`
                : `${type === 'regions' ? (item.value || item.type || 'Region') : (item.type || 'Line')} - ${(Array.isArray(item.coordinates) ? item.coordinates.length : 0)} vertices`;
            button.innerHTML = `${escapeHtml(label)}<span class="map-editor-feature-meta">${escapeHtml(meta)}</span>`;
            button.addEventListener('click', () => selectFeature(type, index));
            dom.unifiedFeatureList.appendChild(button);
        });

        if (filteredItems.length > defaultLimit) {
            dom.featureShowMoreButton.hidden = false;
            dom.featureShowMoreButton.textContent = expanded ? 'Show Less' : `Show All (${filteredItems.length})`;
        }

        dom.featureSummary.textContent = getFeatureSummaryLabel();
    }

    function stringifyCoordinates(coordinates) {
        if (!Array.isArray(coordinates)) return '';
        return coordinates.map((pair) => {
            if (!Array.isArray(pair) || pair.length !== 2) return '';
            return `${roundCoordinate(pair[0])}, ${roundCoordinate(pair[1])}`;
        }).filter(Boolean).join('\n');
    }

    function parseCoordinatePairs(value, minimumPoints) {
        const rows = String(value || '')
            .split('\n')
            .map((row) => row.trim())
            .filter(Boolean);
        const parsedRows = rows.map((row) => {
            const parts = row.split(',').map((segment) => segment.trim());
            if (parts.length !== 2) {
                throw new Error('Each coordinate row must contain exactly two values.');
            }
            const first = roundCoordinate(parts[0]);
            const second = roundCoordinate(parts[1]);
            return [first, second];
        });
        if (parsedRows.length < minimumPoints) {
            throw new Error(`At least ${minimumPoints} coordinate rows are required.`);
        }
        return parsedRows;
    }

    function parseJsonObject(value) {
        const source = String(value || '').trim();
        if (!source) return {};
        const parsed = JSON.parse(source);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Properties must be a JSON object.');
        }
        return parsed;
    }

    function renderFeatureInspector() {
        const feature = getSelectedFeature();
        dom.featureForm.innerHTML = '';

        if (!feature) {
            dom.featureForm.hidden = true;
            dom.featureFormEmpty.hidden = false;
            dom.selectedFeatureChip.textContent = 'None';
            return;
        }

        dom.featureForm.hidden = false;
        dom.featureFormEmpty.hidden = true;

        if (state.selectedFeature.mode === 'points') {
            dom.selectedFeatureChip.textContent = 'POI';
            dom.featureForm.innerHTML = `
                <label>Name<input data-field="name" type="text"></label>
                <label>Pronunciation<input data-field="pronunciation" type="text"></label>
                <label>Type<input data-field="type" type="text"></label>
                <label>Summary<textarea data-field="summary" rows="3"></textarea></label>
                <label>Description<textarea data-field="description" rows="4"></textarea></label>
                <label>Wiki Link<input data-field="wikiLink" type="text"></label>
                <label>Linked Map ID<input data-field="linkedMapId" type="text"></label>
                <div class="map-editor-form-grid">
                    <label>Y<input data-field="coordY" type="number"></label>
                    <label>X<input data-field="coordX" type="number"></label>
                </div>
                <label>Properties JSON<textarea data-field="properties" rows="5"></textarea></label>
            `;
            dom.featureForm.querySelector('[data-field="name"]').value = feature.name || '';
            dom.featureForm.querySelector('[data-field="pronunciation"]').value = feature.pronunciation || '';
            dom.featureForm.querySelector('[data-field="type"]').value = feature.type || '';
            dom.featureForm.querySelector('[data-field="summary"]').value = feature.summary || '';
            dom.featureForm.querySelector('[data-field="description"]').value = feature.description || '';
            dom.featureForm.querySelector('[data-field="wikiLink"]').value = feature.wikiLink || '';
            dom.featureForm.querySelector('[data-field="linkedMapId"]').value = feature.linkedMapId || '';
            dom.featureForm.querySelector('[data-field="coordY"]').value = feature.coords?.[0] ?? '';
            dom.featureForm.querySelector('[data-field="coordX"]').value = feature.coords?.[1] ?? '';
            dom.featureForm.querySelector('[data-field="properties"]').value = JSON.stringify(feature.properties || {}, null, 2);
        } else if (state.selectedFeature.mode === 'regions') {
            dom.selectedFeatureChip.textContent = 'Region';
            dom.featureForm.innerHTML = `
                <label>ID<input data-field="id" type="text"></label>
                <label>Name<input data-field="name" type="text"></label>
                <label>Type<input data-field="type" type="text"></label>
                <label>Value<input data-field="value" type="text"></label>
                <label>Summary<textarea data-field="summary" rows="3"></textarea></label>
                <label>Description<textarea data-field="description" rows="4"></textarea></label>
                <label>Wiki Link<input data-field="wikiLink" type="text"></label>
                <label>Linked Map ID<input data-field="linkedMapId" type="text"></label>
                <div class="map-editor-form-grid">
                    <label>Stroke Color<input data-field="color" type="text"></label>
                    <label>Fill Color<input data-field="fillColor" type="text"></label>
                    <label>Fill Opacity<input data-field="fillOpacity" type="number" step="0.05"></label>
                </div>
                <label>Coordinates<textarea class="map-editor-coordinates" data-field="coordinates" rows="7"></textarea></label>
                <label>Properties JSON<textarea data-field="properties" rows="5"></textarea></label>
            `;
            dom.featureForm.querySelector('[data-field="id"]').value = feature.id || '';
            dom.featureForm.querySelector('[data-field="name"]').value = feature.name || '';
            dom.featureForm.querySelector('[data-field="type"]').value = feature.type || '';
            dom.featureForm.querySelector('[data-field="value"]').value = feature.value || '';
            dom.featureForm.querySelector('[data-field="summary"]').value = feature.summary || '';
            dom.featureForm.querySelector('[data-field="description"]').value = feature.description || '';
            dom.featureForm.querySelector('[data-field="wikiLink"]').value = feature.wikiLink || '';
            dom.featureForm.querySelector('[data-field="linkedMapId"]').value = feature.linkedMapId || '';
            dom.featureForm.querySelector('[data-field="color"]').value = feature.color || '';
            dom.featureForm.querySelector('[data-field="fillColor"]').value = feature.fillColor || '';
            dom.featureForm.querySelector('[data-field="fillOpacity"]').value = feature.fillOpacity ?? '';
            dom.featureForm.querySelector('[data-field="coordinates"]').value = stringifyCoordinates(feature.coordinates || []);
            dom.featureForm.querySelector('[data-field="properties"]').value = JSON.stringify(feature.properties || {}, null, 2);
        } else {
            dom.selectedFeatureChip.textContent = 'Line';
            dom.featureForm.innerHTML = `
                <label>ID<input data-field="id" type="text"></label>
                <label>Name<input data-field="name" type="text"></label>
                <label>Type<input data-field="type" type="text"></label>
                <label>Summary<textarea data-field="summary" rows="3"></textarea></label>
                <label>Description<textarea data-field="description" rows="4"></textarea></label>
                <label>Wiki Link<input data-field="wikiLink" type="text"></label>
                <label>Linked Map ID<input data-field="linkedMapId" type="text"></label>
                <div class="map-editor-form-grid">
                    <label>Color<input data-field="color" type="text"></label>
                    <label>Weight<input data-field="weight" type="number" step="1" min="1"></label>
                    <label>Dash Array<input data-field="dashArray" type="text"></label>
                </div>
                <label>Coordinates<textarea class="map-editor-coordinates" data-field="coordinates" rows="7"></textarea></label>
                <label>Properties JSON<textarea data-field="properties" rows="5"></textarea></label>
            `;
            dom.featureForm.querySelector('[data-field="id"]').value = feature.id || '';
            dom.featureForm.querySelector('[data-field="name"]').value = feature.name || '';
            dom.featureForm.querySelector('[data-field="type"]').value = feature.type || '';
            dom.featureForm.querySelector('[data-field="summary"]').value = feature.summary || '';
            dom.featureForm.querySelector('[data-field="description"]').value = feature.description || '';
            dom.featureForm.querySelector('[data-field="wikiLink"]').value = feature.wikiLink || '';
            dom.featureForm.querySelector('[data-field="linkedMapId"]').value = feature.linkedMapId || '';
            dom.featureForm.querySelector('[data-field="color"]').value = feature.color || '';
            dom.featureForm.querySelector('[data-field="weight"]').value = feature.weight ?? '';
            dom.featureForm.querySelector('[data-field="dashArray"]').value = feature.dashArray || '';
            dom.featureForm.querySelector('[data-field="coordinates"]').value = stringifyCoordinates(feature.coordinates || []);
            dom.featureForm.querySelector('[data-field="properties"]').value = JSON.stringify(feature.properties || {}, null, 2);
        }
    }

    function updateSelectedFeatureFromForm(event) {
        const feature = getSelectedFeature();
        if (!feature) return;

        const field = event.target.dataset.field;
        if (!field) return;

        try {
            if (state.selectedFeature.mode === 'points') {
                if (field === 'coordY' || field === 'coordX') {
                    const nextY = field === 'coordY' ? event.target.value : dom.featureForm.querySelector('[data-field="coordY"]').value;
                    const nextX = field === 'coordX' ? event.target.value : dom.featureForm.querySelector('[data-field="coordX"]').value;
                    feature.coords = [roundCoordinate(nextY), roundCoordinate(nextX)];
                } else if (field === 'properties') {
                    feature.properties = parseJsonObject(event.target.value);
                } else {
                    feature[field] = event.target.value;
                }
            } else if (field === 'coordinates') {
                const minimumPoints = state.selectedFeature.mode === 'regions' ? 3 : 2;
                feature.coordinates = parseCoordinatePairs(event.target.value, minimumPoints);
            } else if (field === 'properties') {
                feature.properties = parseJsonObject(event.target.value);
            } else if (field === 'fillOpacity' || field === 'weight') {
                feature[field] = Number(event.target.value);
            } else {
                feature[field] = event.target.value;
            }

            setSelectionStatus(`Updated ${state.selectedFeature.mode.slice(0, -1)} fields.`);
            renderFeatureLists();
            renderMapLayers(false);
        } catch (error) {
            setSelectionStatus(error.message || 'Could not apply feature changes.');
        }
    }

    function buildParentOptions() {
        if (!state.currentMapId) return [];

        const currentNode = utils.findMapRecursive(state.atlasTree, state.currentMapId);
        const excludedIds = new Set([state.currentMapId]);
        collectDescendantIds(currentNode, excludedIds);

        const options = [{ id: '', label: 'Root' }];
        (function walk(items) {
            if (!Array.isArray(items)) return;
            items.forEach((item) => {
                if (!item || typeof item !== 'object' || !item.id) return;
                if (!excludedIds.has(item.id)) {
                    options.push({
                        id: item.id,
                        label: item.name || item.id
                    });
                }
                walk(item.children);
            });
        }(state.atlasTree));

        return options;
    }

    function renderMapSettingsForm() {
        const currentMap = state.currentMap;
        const currentLocation = currentMap ? findNodeLocation(state.atlasTree, currentMap.id) : null;

        const inputs = dom.mapSettingsInputs;
        if (inputs.name) inputs.name.value = currentMap?.name || '';
        if (inputs.type) inputs.type.value = currentMap?.type || '';
        if (inputs.status) inputs.status.value = currentMap?.status || '';
        if (inputs.visibility) inputs.visibility.value = currentMap?.visibility || '';
        if (inputs.group) inputs.group.value = currentMap?.group || currentMap?.category || '';
        if (inputs.dataUrl) inputs.dataUrl.value = currentMap?.dataUrl || '';
        if (inputs.order) inputs.order.value = currentLocation ? currentLocation.index : 0;
        if (inputs.imageUrl) inputs.imageUrl.value = currentMap?.imageUrl || '';
        if (inputs.mobileImageUrl) inputs.mobileImageUrl.value = currentMap?.mobileImageUrl || '';
        if (inputs.smallImageUrl) inputs.smallImageUrl.value = currentMap?.smallImageUrl || '';
        if (inputs.width) inputs.width.value = currentMap?.width ?? '';
        if (inputs.height) inputs.height.value = currentMap?.height ?? '';
        if (inputs.scalePixels) inputs.scalePixels.value = currentMap?.scalePixels ?? '';
        if (inputs.scaleKilometers) inputs.scaleKilometers.value = currentMap?.scaleKilometers ?? '';
        if (inputs.scaleUnitName) inputs.scaleUnitName.value = currentMap?.scaleUnitName || '';
        if (inputs.backgroundColor) inputs.backgroundColor.value = currentMap?.backgroundColor || '';
        if (inputs.atmosphere) inputs.atmosphere.value = currentMap?.atmosphere || '';
        if (inputs.latNorth) inputs.latNorth.value = currentMap?.latLonBounds?.north ?? '';
        if (inputs.latSouth) inputs.latSouth.value = currentMap?.latLonBounds?.south ?? '';
        if (inputs.latEast) inputs.latEast.value = currentMap?.latLonBounds?.east ?? '';
        if (inputs.latWest) inputs.latWest.value = currentMap?.latLonBounds?.west ?? '';
        if (inputs.blurb) inputs.blurb.value = currentMap?.blurb || '';
        if (inputs.selectorDescription) inputs.selectorDescription.value = currentMap?.selectorDescription || '';

        const parentSelect = inputs.parentIdSelect;
        const options = buildParentOptions();
        if (parentSelect) {
            parentSelect.innerHTML = '';
            options.forEach((option) => {
                const optEl = document.createElement('option');
                optEl.value = option.id;
                optEl.textContent = option.label;
                if (option.id === (currentLocation?.parentId || '')) {
                    optEl.selected = true;
                }
                parentSelect.appendChild(optEl);
            });
        }

        dom.currentMapId.textContent = currentMap?.id || 'No map';
    }

    function updateTreeAfterSettingsChange() {
        if (!state.currentMap) return;

        const nextSettings = readMapSettingsForm();
        utils.applyMapSettings(state.currentMap, nextSettings);

        const parentId = dom.mapSettingsInputs.parentIdSelect.value;
        const orderValue = dom.mapSettingsInputs.order.value;
        const currentLocation = findNodeLocation(state.atlasTree, state.currentMap.id);
        const nextOrder = Number.isFinite(Number(orderValue)) ? Number(orderValue) : currentLocation?.index || 0;
        const currentParentId = currentLocation?.parentId || '';
        const currentOrder = currentLocation?.index || 0;

        if (parentId !== currentParentId || nextOrder !== currentOrder) {
            state.atlasTree = moveNodeInTree(state.atlasTree, state.currentMap.id, parentId, nextOrder);
            if (parentId) state.expandedFolderIds.add(parentId);
            state.currentMap = utils.findMapRecursive(state.atlasTree, state.currentMap.id);
        }

        renderAtlasTree();
        renderMapSettingsForm();
        renderMapLayers(true);
        setSelectionStatus(`Updated map settings for "${state.currentMap.name || state.currentMap.id}".`);
    }

    function createVertexIcon() {
        return L.divIcon({
            className: '',
            html: '<div class="editor-vertex-icon"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
    }

    function renderDraftGeometry() {
        state.draftLayer.clearLayers();
        if (!state.drawMode || state.draftCoordinates.length === 0) return;

        const options = {
            color: '#f97316',
            weight: 3,
            dashArray: '6 4'
        };
        if (state.drawMode === 'region' && state.draftCoordinates.length >= 2) {
            state.draftLayer.addLayer(L.polygon(state.draftCoordinates, {
                ...options,
                fillOpacity: 0.12
            }));
        } else {
            state.draftLayer.addLayer(L.polyline(state.draftCoordinates, options));
        }
    }

    function renderVertexHandles() {
        state.vertexLayer.clearLayers();
        const feature = getSelectedFeature();
        if (!feature || state.selectedFeature.mode === 'points') return;

        const coordinates = Array.isArray(feature.coordinates) ? feature.coordinates : [];
        coordinates.forEach((coordinate, index) => {
            const handle = L.marker(coordinate, {
                icon: createVertexIcon(),
                draggable: true,
                keyboard: false
            });
            handle.on('drag', (event) => {
                feature.coordinates[index] = roundLatLng(event.target.getLatLng());
            });
            handle.on('dragend', () => {
                renderMapLayers(false);
                renderFeatureInspector();
                renderFeatureLists();
                setSelectionStatus('Updated geometry vertex.');
            });
            state.vertexLayer.addLayer(handle);
        });
    }

    function handleUnrenderableMap() {
        clearMapVisualLayers();
        state.currentBounds = null;
        setMapEmptyState({
            hidden: false,
            title: 'No Renderable Map Selected',
            copy: 'Select a map with image data to edit points, regions, and lines.',
            detail: state.currentMap
                ? `Image URL: ${state.currentMap.imageUrl || 'Missing imageUrl'}`
                : ''
        });
        setSelectionStatus('This map does not have renderable image data yet.');
        renderVertexHandles();
        renderDraftGeometry();
        syncToolbarState();
    }

    function setupImageUnderlay(mapHeight, mapWidth, nextBounds) {
        clearMapVisualLayers();
        state.currentBounds = nextBounds;
        state.underlayLayer = L.rectangle(nextBounds, {
            stroke: false,
            fill: true,
            fillOpacity: 1,
            fillColor: state.currentMap.backgroundColor || '#0f172a',
            interactive: false,
            pane: 'tilePane'
        }).addTo(state.map);
        setMapEmptyState({
            hidden: false,
            title: 'Loading Map Image',
            copy: `Loading "${state.currentMap.name || state.currentMap.id}" into the editor canvas...`,
            detail: `Image URL: ${state.currentMap.imageUrl}`
        });
        setSelectionStatus(`Loading image for "${state.currentMap.name || state.currentMap.id}"...`);

        const imageLayer = L.imageOverlay(state.currentMap.imageUrl, nextBounds);
        imageLayer.once('load', () => {
            if (state.imageLayer !== imageLayer) return;
            setMapEmptyState({ hidden: true });
            setSelectionStatus(`Image loaded for "${state.currentMap.name || state.currentMap.id}".`);
            queueMapViewportReset();
        });
        imageLayer.once('error', () => {
            if (state.imageLayer !== imageLayer) return;
            state.map.removeLayer(imageLayer);
            state.imageLayer = null;
            setMapEmptyState({
                hidden: false,
                title: 'Image Failed To Load',
                copy: `The editor could not render "${state.currentMap.name || state.currentMap.id}".`,
                detail: `Image URL: ${state.currentMap.imageUrl}`
            });
            setSelectionStatus(`Image failed to load for "${state.currentMap.name || state.currentMap.id}".`);
        });
        state.imageLayer = imageLayer;
        state.imageLayer.addTo(state.map);
    }

    function renderPointsLayer() {
        getCurrentPoints().forEach((point, index) => {
            if (!Array.isArray(point.coords) || point.coords.length !== 2) return;
            const marker = L.marker(point.coords, {
                draggable: true
            });
            marker.on('click', () => selectFeature('points', index));
            marker.on('drag', (event) => {
                point.coords = roundLatLng(event.target.getLatLng());
            });
            marker.on('dragend', () => {
                renderFeatureInspector();
                renderFeatureLists();
                setSelectionStatus(`Moved POI "${point.name || `POI ${index + 1}`}".`);
            });
            state.pointLayer.addLayer(marker);
        });
    }

    function renderRegionsLayer() {
        getCurrentRegions().forEach((region, index) => {
            if (!Array.isArray(region.coordinates) || region.coordinates.length < 3) return;
            const layer = L.polygon(region.coordinates, {
                color: region.color || '#2563eb',
                fillColor: region.fillColor || region.color || '#2563eb',
                fillOpacity: Number(region.fillOpacity ?? 0.2),
                weight: state.selectedFeature?.mode === 'regions' && state.selectedFeature.index === index ? 3 : 2
            });
            layer.on('click', () => selectFeature('regions', index));
            state.regionLayer.addLayer(layer);
        });
    }

    function renderLinesLayer() {
        getCurrentLines().forEach((line, index) => {
            if (!Array.isArray(line.coordinates) || line.coordinates.length < 2) return;
            const layer = L.polyline(line.coordinates, {
                color: line.color || '#0f766e',
                weight: Number(line.weight || 3),
                dashArray: line.dashArray || ''
            });
            layer.on('click', () => selectFeature('lines', index));
            state.lineLayer.addLayer(layer);
        });
    }

    function renderMapLayers(resetView) {
        state.pointLayer.clearLayers();
        state.regionLayer.clearLayers();
        state.lineLayer.clearLayers();

        const mapIsRenderable = canRenderMap(state.currentMap);

        if (!mapIsRenderable) {
            handleUnrenderableMap();
            return;
        }

        const mapHeight = Number(state.currentMap.height);
        const mapWidth = Number(state.currentMap.width);
        const nextBounds = [[0, 0], [mapHeight, mapWidth]];
        const needsImageReset = !state.currentBounds ||
            state.currentBounds[1][0] !== mapHeight ||
            state.currentBounds[1][1] !== mapWidth ||
            !state.imageLayer ||
            state.imageLayer._url !== state.currentMap.imageUrl;

        if (needsImageReset) {
            setupImageUnderlay(mapHeight, mapWidth, nextBounds);
        } else if (state.underlayLayer) {
            state.underlayLayer.setStyle({
                fillColor: state.currentMap.backgroundColor || '#0f172a',
                color: state.currentMap.backgroundColor || '#0f172a'
            });
            setMapEmptyState({ hidden: true });
        }

        renderPointsLayer();
        renderRegionsLayer();
        renderLinesLayer();

        renderVertexHandles();
        renderDraftGeometry();

        if (resetView && state.currentBounds) {
            queueMapViewportReset();
        }

        syncToolbarState();
    }

    function finishDraftGeometry() {
        if (!state.currentMap) return;
        const draft = utils.cloneJson(state.draftCoordinates);
        if (state.drawMode === 'region') {
            if (draft.length < 3) {
                setSelectionStatus('A region needs at least 3 points.');
                return;
            }
            getCurrentRegions().push({
                id: `region-${Date.now()}`,
                name: `Region ${getCurrentRegions().length + 1}`,
                type: '',
                value: '',
                description: '',
                summary: '',
                wikiLink: '',
                linkedMapId: '',
                color: '#2563eb',
                fillColor: '#60a5fa',
                fillOpacity: 0.2,
                coordinates: draft,
                properties: {}
            });
            clearDrawMode();
            state.featureListState.type = 'regions';
            selectFeature('regions', getCurrentRegions().length - 1);
            setSelectionStatus('Created a new region.');
            return;
        }

        if (draft.length < 2) {
            setSelectionStatus('A line needs at least 2 points.');
            return;
        }
        getCurrentLines().push({
            id: `line-${Date.now()}`,
            name: `Line ${getCurrentLines().length + 1}`,
            type: '',
            color: '#0f766e',
            weight: 3,
            dashArray: '',
            description: '',
            summary: '',
            wikiLink: '',
            linkedMapId: '',
            coordinates: draft,
            properties: {}
        });
        clearDrawMode();
        state.featureListState.type = 'lines';
        selectFeature('lines', getCurrentLines().length - 1);
        setSelectionStatus('Created a new line.');
    }

    function handleMapClick(event) {
        if (!state.currentMap || !canRenderMap(state.currentMap)) return;
        const coordinate = roundLatLng(event.latlng);

        if (state.drawMode === 'point') {
            getCurrentPoints().push({
                name: `POI ${getCurrentPoints().length + 1}`,
                coords: coordinate,
                type: 'Unknown',
                description: '',
                summary: '',
                wikiLink: '',
                linkedMapId: '',
                properties: {}
            });
            clearDrawMode();
            state.featureListState.type = 'points';
            selectFeature('points', getCurrentPoints().length - 1);
            setSelectionStatus('Added a new POI.');
            return;
        }

        if (state.drawMode === 'region' || state.drawMode === 'line') {
            state.draftCoordinates.push(coordinate);
            renderDraftGeometry();
            setSelectionStatus(`Draft ${state.drawMode}: ${state.draftCoordinates.length} points.`);
        }
    }

    function deleteSelectedFeature() {
        if (!state.selectedFeature) return;
        const feature = getSelectedFeature();
        const label = feature.name || feature.id || 'this feature';
        if (!window.confirm(`Are you sure you want to delete ${label}?`)) return;
        const collection = getCurrentFeatureCollection(state.selectedFeature.mode);
        collection.splice(state.selectedFeature.index, 1);
        deselectFeature();
        renderFeatureLists();
        renderMapLayers(false);
        setSelectionStatus('Deleted the selected feature.');
    }

    function beginDrawMode(mode) {
        if (!canRenderMap(state.currentMap)) return;
        state.drawMode = mode;
        state.draftCoordinates = [];
        deselectFeature();
        renderDraftGeometry();
        syncToolbarState();
        setSelectionStatus(mode === 'point'
            ? 'Click the map to place a new POI.'
            : `Click the map to add ${mode} vertices, then finish the draft.`);
    }

    function getExportFileName(url, fallbackId) {
        const normalizedUrl = String(url || '').trim();
        if (normalizedUrl) {
            const parts = normalizedUrl.split('/');
            return parts[parts.length - 1];
        }
        return `${String(fallbackId || 'map').trim() || 'map'}.json`;
    }

    function downloadJsonFile(fileName, value) {
        const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
    }

    function exportCurrentMapJson() {
        if (!state.currentMap) return;
        try {
            const exportedDocument = utils.serializeMapDocumentState({
                masterMapData: state.atlasTree,
                currentMapId: state.currentMap.id,
                collectedPoints: getCurrentPoints(),
                collectedRegions: getCurrentRegions(),
                collectedLines: getCurrentLines(),
                lineCollectionKey: state.lineCollectionKey,
                mapSettings: readMapSettingsForm()
            });
            const fileName = getExportFileName(state.currentMap.dataUrl, state.currentMap.id);
            downloadJsonFile(fileName, exportedDocument);
            setExportStatus(`Exported ${fileName}.`);
        } catch (error) {
            console.error(error);
            setExportStatus(error.message || 'Could not export the current map.', true);
        }
    }

    function exportAtlasStructure() {
        try {
            const exportedManifest = utils.serializeFlatManifestState({
                masterMapData: state.atlasTree,
                currentMapId: state.currentMap?.id || '',
                mapSettings: state.currentMap ? readMapSettingsForm() : {}
            });
            downloadJsonFile('maps.json', exportedManifest);
            setExportStatus('Exported maps.json.');
        } catch (error) {
            console.error(error);
            setExportStatus(error.message || 'Could not export maps.json.', true);
        }
    }

    async function selectMap(mapId) {
        const atlasNode = utils.findMapRecursive(state.atlasTree, mapId);
        if (!atlasNode) {
            throw new Error(`Could not find map "${mapId}".`);
        }

        state.currentMapId = mapId;
        clearDrawMode();
        deselectFeature();

        const canResolve = Boolean(
            String(atlasNode.dataUrl || '').trim() ||
            String(atlasNode.imageUrl || '').trim() ||
            Array.isArray(atlasNode.pointsOfInterest) ||
            Array.isArray(atlasNode.regions) ||
            Array.isArray(atlasNode.lines) ||
            Array.isArray(atlasNode.roads)
        );

        if (canResolve) {
            const resolvedMap = await utils.resolveFileBackedMapDocument(atlasNode, {
                loadJsonByPath: (relativePath) => fetchJsonAsset(relativePath)
            });
            state.atlasTree = replaceNodeById(state.atlasTree, mapId, resolvedMap);
        }

        state.currentMap = utils.findMapRecursive(state.atlasTree, mapId);
        state.lineCollectionKey = utils.detectLineCollectionKey(state.currentMap);
        renderAtlasTree();
        renderMapSettingsForm();
        renderFeatureLists();
        renderFeatureInspector();
        setSelectionStatus(`Editing "${state.currentMap.name || state.currentMap.id}".`);
        renderMapLayers(true);
        setExportStatus('');

        dom.appShell.setAttribute('data-mode', 'edit');
        queueMapViewportReset();
    }

    function initializeMap() {
        state.map = L.map('editor-map', {
            crs: L.CRS.Simple,
            minZoom: -4,
            maxZoom: 3,
            zoomSnap: 0.25,
            zoomDelta: 0.25,
            doubleClickZoom: false
        });
        state.map.setView([0, 0], 0, { animate: false });
        state.map.on('click', handleMapClick);

        state.pointLayer = L.layerGroup().addTo(state.map);
        state.regionLayer = L.layerGroup().addTo(state.map);
        state.lineLayer = L.layerGroup().addTo(state.map);
        state.vertexLayer = L.layerGroup().addTo(state.map);
        state.draftLayer = L.layerGroup().addTo(state.map);
        window.addEventListener('resize', queueMapViewportReset);
    }

    function registerEventListeners() {
        const debouncedRenderAtlasTree = debounce((value) => {
            state.treeSearch = String(value || '').trim();
            renderAtlasTree();
        }, 300);

        dom.treeSearch.addEventListener('input', (event) => {
            debouncedRenderAtlasTree(event.target.value);
        });

        dom.reloadButton.addEventListener('click', () => {
            window.location.reload();
        });

        dom.mapSettingsForm.addEventListener('change', () => {
            if (!state.currentMap) return;
            try {
                updateTreeAfterSettingsChange();
            } catch (error) {
                console.error(error);
                setSelectionStatus(error.message || 'Could not apply map settings.');
            }
        });

        dom.featureForm.addEventListener('change', updateSelectedFeatureFromForm);

        // ⚡ Bolt: Debounce input handling to prevent UI lag on every keystroke
        const debouncedUpdateSelectedFeatureFromForm = debounce((event) => {
            updateSelectedFeatureFromForm(event);
        }, 300);

        dom.featureForm.addEventListener('input', (event) => {
            const field = event.target.dataset.field;
            if (!field || field === 'description' || field === 'summary') return;
            debouncedUpdateSelectedFeatureFromForm(event);
        });

        dom.featureTypeSelect.addEventListener('change', (event) => {
            state.featureListState.type = event.target.value;
            state.featureListState.expanded = false;
            renderFeatureLists();
        });

        const debouncedRenderFeatureLists = debounce((value) => {
            state.featureListState.searchQuery = value;
            state.featureListState.expanded = false;
            renderFeatureLists();
        }, 300);

        dom.featureSearchInput.addEventListener('input', (event) => {
            debouncedRenderFeatureLists(event.target.value);
        });

        dom.featureShowMoreButton.addEventListener('click', () => {
            state.featureListState.expanded = !state.featureListState.expanded;
            renderFeatureLists();
        });

        dom.addPoiButton.addEventListener('click', () => beginDrawMode('point'));
        dom.addRegionButton.addEventListener('click', () => beginDrawMode('region'));
        dom.addLineButton.addEventListener('click', () => beginDrawMode('line'));
        dom.finishDrawButton.addEventListener('click', finishDraftGeometry);
        dom.cancelDrawButton.addEventListener('click', () => {
            clearDrawMode();
            setSelectionStatus('Canceled the current draft.');
        });
        dom.deleteSelectionButton.addEventListener('click', deleteSelectedFeature);
        dom.resetViewButton.addEventListener('click', () => {
            if (state.currentBounds) {
                queueMapViewportReset();
            }
        });
        if (dom.chooseMapButton) {
            dom.chooseMapButton.addEventListener('click', () => {
                dom.appShell.setAttribute('data-mode', 'select');
            });
        }
        dom.exportCurrentMapButton.addEventListener('click', exportCurrentMapJson);
        dom.exportAtlasStructureButton.addEventListener('click', exportAtlasStructure);
    }

    async function initializeEditor() {
        try {
            initializeMap();
            registerEventListeners();

            const atlas = await fetchJsonAsset('maps/atlas-index.json');
            if (!atlas || !Array.isArray(atlas.tree)) {
                throw new Error('maps/atlas-index.json did not return a valid tree.');
            }

            state.atlasTree = utils.normalizeManifestTree(atlas.tree);
            state.expandedFolderIds = new Set();
            (function expandAllFolders(items) {
                if (!Array.isArray(items)) return;
                items.forEach((item) => {
                    if (!item || typeof item !== 'object') return;
                    if (Array.isArray(item.children) && item.children.length > 0) {
                        state.expandedFolderIds.add(item.id);
                        expandAllFolders(item.children);
                    }
                });
            }(state.atlasTree));
            renderAtlasTree();

            const initialMap = utils.collectMapSelectionEntries(state.atlasTree).find((entry) => !entry.disabled);
            if (initialMap) {
                await selectMap(initialMap.id);
            } else {
                renderMapSettingsForm();
                renderFeatureLists();
                renderFeatureInspector();
                setSelectionStatus('No loadable maps were found in the atlas.');
            }
        } catch (error) {
            console.error(error);
            setSelectionStatus(error.message || 'Could not initialize the map editor.');
            dom.atlasTree.innerHTML = `<p class="map-editor-placeholder">${escapeHtml(error.message || 'Initialization failed.')}</p>`;
        }
    }

    initializeEditor();
}());
